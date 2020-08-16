/*
 * WHAT IS CREATED
 * This file creates:
 * - API gateway, 
 * - customized authorizer Lambda function that uses Auth0
 * - Lambda function that handles the API requests
 * - DynamoDB for the backend database
 * 
 * INITIAL SETUP
 * 1) Login to Auth0.com and Create API
 * 2) Go to quickstart and select node.js
 * 3) Note the jwksUri, audience, issuer and create pulumi config set --secret for these:
 *    e.g. pulumi config set --secret issuer https://goo.auth0.com
 * 
 * Using the API:
 * 1) Look at API gateway in AWS and go to the stage and copy the URL
 * 2) Create a GET to that URL/<resoruce> (e.g. https://URL/customers)
 * 3) Set Authorization Token to the ACCESS_TOKEN returned by the authentication above.
 * 4) Run the GET and you should see output commensurate with the event handler code below.t
 * 
 * TESTING the created backend API with POSTMAN
 * Postman export file can be found under the main folder.
 * Authentication:
 * POST to the auth0 authenticator.
 * Look at API's Test tab for values to use and create an POST with this body:
 * {
	"client_id": "{{CLIENT_ID}}",
	"client_secret": "{{CLIENT_SECRET}}",
	"audience": "{{AUDIENCE}}",
	"grant_type": "client_credentials"
   }
 *
 */

import * as awsx from "@pulumi/awsx";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as AWS from "aws-sdk"
import * as jwt from "jsonwebtoken";
import * as jwksClient from "jwks-rsa";
import * as util from "util";
const fetch = require("node-fetch");

import { isTestModeEnabled } from "@pulumi/pulumi/runtime";
//import * as authenticate from "authLib";

const config = new pulumi.Config();
const jwksUri = config.require("jwksUri");
const audience = config.require("audience");
const issuer = config.require("issuer");
const mgmtClientId = config.require("mgmt_client_id");
const mgmtClientSecret = config.require("mgmt_client_secret");
const mgmtAudience = config.require("mgmt_audience");

// Create DynamoDB table to store the customer information.
// It is keyed by the user email address.
const dbTableName = "pizza42-customers" 
const fileTable = new aws.dynamodb.Table(dbTableName, {
    attributes: [
        {
            name: "email",
            type: "S",
        },
    ],
    billingMode: "PROVISIONED",
    hashKey: "email",
    readCapacity: 5,
    writeCapacity: 5,
    /*
    ttl: {
        attributeName: "TimeToExist",
        enabled: false,
    },
    */
    name: dbTableName, // assures the table name is known. to-do: figure out how to use generated table name in the magic function.
});

// Build API gateway and related Lambda custom authorizer and event handler
const authorizerLambda = async (event: awsx.apigateway.AuthorizerEvent) => {
    try {
        return await authenticate(event);
    }
    catch (err) {
        console.log(err);
        // Tells API Gateway to return a 401 Unauthorized response
        throw new Error("Unauthorized "+JSON.stringify(err));
    }
};

// Helper function to retrieve specific customer data from DB 
 async function getCustomer(dbName: string, email: string) {
    const dbClient = new AWS.DynamoDB.DocumentClient();
    // DynamoDB entry
    let dbParams = {
        Key: {
            email: email, 
        },
        TableName: dbName,
    }
    console.log("GET dbParams",dbParams)

    // get the DB entry
    const tableItem = await dbClient.get(dbParams, function(err, data) {
        if (err) {
            console.log("DB GET ERROR",err);
        } else {
            console.log("DB GET SUCCESS", data);
        };
    }).promise();
    return tableItem.Item;
}

// Removes specific customer data from DB 
async function removeCustomer(dbName: string, email: string) {
    const dbClient = new AWS.DynamoDB.DocumentClient();
    // DynamoDB entry
    let dbParams = {
        Key: {
            email: email, 
        },
        TableName: dbName,
    }
    console.log("REMOVE dbParams",dbParams)

    // Delete the DB entry
    const tableItem = await dbClient.delete(dbParams, function(err, data) {
        if (err) {
            console.log("DB REMOVE ERROR",err);
        } else {
            console.log("DB REMOVE SUCCESS", data);
        };
    }).promise();
    return tableItem;
}

// Returns Auth0 management API access token.
// This token is used with the Auth0 management API (which is different than user auth) to interact 
// with Auth0 administrator functions.
async function getAuth0MgmtAccessToken() {
    const token_url = issuer+"oauth/token"
    const reqheaders = { "Content-Type":"application/json", } 
    type PayLoad = {
        client_id: string,
        client_secret: string,
        audience: string,
        grant_type: string
    }
    const payload: PayLoad = {
        client_id: mgmtClientId,
        client_secret: mgmtClientSecret,
        audience: mgmtAudience,
        grant_type: "client_credentials"
    }
    const opts: RequestInit = {
        method: 'POST',
        headers: reqheaders,
        body: JSON.stringify(payload)
    }

    const token_fetch = await fetch(token_url, opts);
    const token_data = await token_fetch.json()
    console.log("DEBUG token_data",JSON.stringify(token_data))
    const mgmt_token = token_data.access_token;
    console.log("DEBUG mgmt_token",mgmt_token)

    return mgmt_token
}

// Takes Auth0 sub ID (e.g. "auth0|1234566") and an Auth0 management access token.
// Returns the detailed user data as stringified JSON.
async function getAuth0DetailedUser(sub: string, mgmtToken: string) {
    // Auth0 user info API
    let userUrl = mgmtAudience+"users/"+sub;

    const userFetch = await fetch(userUrl, {
        method: 'GET',
        headers: {'Authorization': 'Bearer '+ mgmtToken }
    })
    const userData = await userFetch.json();
    const stringyUserData = JSON.stringify(userData);

    console.log("DEBUG detailed user_data",stringyUserData)
    return stringyUserData
}

// Takes stringified Auth0 detailed user data JSON
// Returns the google access token from that data if found.
function getGoogleUserInfo(auth0UserData: string) {
    let userData = JSON.parse(auth0UserData);
    let googleAccessToken = "";
    let googleUserId = "";
    let identities = userData.identities;
    for (let i = 0; i < identities.length; i++) {
        let id = identities[i];
        if (id.provider === "google-oauth2") {
            googleAccessToken = id.access_token;
            googleUserId = id.user_id;
        }
    }
    return {googleAccessToken, googleUserId};
}

/*
 * Calls google People API to get connection info.
 * https://github.com/google/google-api-javascript-client/blob/master/samples/authSample.html
 * https://developers.google.com/people/api/rest/
*/
async function getGoogleConns(sub: string)  {
    // Get google user info from Auth0
    const auth0MgmtToken = await getAuth0MgmtAccessToken() 
    const auth0UserData = await getAuth0DetailedUser(sub, auth0MgmtToken) 
    const googleInfo = getGoogleUserInfo(auth0UserData)
    const googleAccessToken = googleInfo.googleAccessToken;
    const googleUserId = googleInfo.googleUserId;

    // Google people API URI
    const googlePeopleUrl = "https://people.googleapis.com/v1/people/"+googleUserId+"?access_token="+googleAccessToken+"&personFields=memberships,emailAddresses,names,relations,organizations,userDefined"
    const userDataFetch = await fetch(googlePeopleUrl, {
        method: 'GET',
        headers: {'Accept': '*/*'}
    })
    const userData = await userDataFetch.json();
    const stringyUserData = JSON.stringify(userData);
    console.log("DEBUG GOOGLE user_data",stringyUserData)

    let googleConns = userData.names.length;

    return googleConns
}

// Adds specific customer data to DB 
async function addCustomer(dbName: string, newCustomerData: {email: string, subId:string}) {
    // add google connections data to the user data if a google user
    let googleConns = 0
    const custSub = newCustomerData.subId
    const email = newCustomerData.email
    if (custSub.search("google-oauth2") != -1) {
        googleConns = await getGoogleConns(custSub) 
    }
    const gcons = {
        googleConns: googleConns
    }

    const dbItem = {
        ...newCustomerData,
        ...gcons
    }
    // It's a new push
    const dbClient = new AWS.DynamoDB.DocumentClient();
    let dbParams = {
        Item: dbItem,
        TableName: dbName,
    }
    // Get the entry we just pushed as a way to test things and to get latest data.
    const tableItem = await dbClient.put(dbParams, function(err, data) {
        if (err) {
            console.log("DB PUSH ERROR",err);
        } else {
            console.log("DB PUSH SUCCESS", data);
        };
    }).promise();
    return getCustomer(dbName, newCustomerData.email);
}

const api = new awsx.apigateway.API("auth0-exercise-api", {
    routes: [
    {
        path: "/customer",// ?email=CUSTOMER_EMAIL
        method: "OPTIONS",
        eventHandler: async (event) => {
            let result = {}
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*',
                    'Access-Control-Allow-Methods': '*',
                    'Access-Control-Allow-Credentials': '*',
                },
                body: JSON.stringify(result)
            };
        },
        authorizers: awsx.apigateway.getTokenLambdaAuthorizer({
            authorizerName: "jwt-rsa-custom-authorizer-options",
            header: "Authorization",
            handler: authorizerLambda,
            identityValidationExpression: "^Bearer [-0-9a-zA-Z\._]*$",
            authorizerResultTtlInSeconds: 3600,
        }),
    },
    {
        path: "/customer",// ?email=CUSTOMER_EMAIL
        method: "GET",
        eventHandler: async (event) => {
            let params = event.queryStringParameters || {}; // params
            let email = params.email || "";
            let result = await getCustomer(dbTableName, email);
            if (!result) {
                result = {}
            }
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*',
                    'Access-Control-Allow-Methods': '*',
                    'Access-Control-Allow-Credentials': '*',
                },
                body: JSON.stringify(result)
            };
        },
        authorizers: awsx.apigateway.getTokenLambdaAuthorizer({
            authorizerName: "jwt-rsa-custom-authorizer-get-query",
            header: "Authorization",
            handler: authorizerLambda,
            identityValidationExpression: "^Bearer [-0-9a-zA-Z\._]*$",
            authorizerResultTtlInSeconds: 3600,
        }),
    },
    {
        path: "/customer", // ?email=CUSTOMER_EMAIL
        method: "DELETE",
        eventHandler: async (event) => {
            let params = event.queryStringParameters || {}; // params
            let email = params.email || "";
            let result = await removeCustomer(dbTableName, email);
            return {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*',
                    'Access-Control-Allow-Methods': '*',
                    'Access-Control-Allow-Credentials': '*',
                },
                statusCode: 200,
                body: JSON.stringify(result)
            };
        },
        authorizers: awsx.apigateway.getTokenLambdaAuthorizer({
            authorizerName: "jwt-rsa-custom-authorizer-delete",
            header: "Authorization",
            handler: authorizerLambda,
            identityValidationExpression: "^Bearer [-0-9a-zA-Z\._]*$",
            authorizerResultTtlInSeconds: 3600,
        }),
    },
    {
        path: "/customer",  // { email: CUSTOMER_EMAIL, lastName: LASTNAME, firstName: FIRSTNAME, phone: PHONE, gender: M|F, googleConns: GOOGLECONNS}
        method: "POST",
        eventHandler: async (event) => {
            let body = event.body || ""; // Body is base64 encoded
            let decodedBody:string = Buffer.from(body, 'base64').toString('ascii') // decode from base64 to string json
            let jsonBody = JSON.parse(decodedBody); // convert from string formatted json to a json object that can be referenced.
            let result = await addCustomer(dbTableName, jsonBody);
            return {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*',
                    'Access-Control-Allow-Methods': '*',
                    'Access-Control-Allow-Credentials': '*'
                },
                statusCode: 200,
                body: JSON.stringify(result)
            }
        },
        authorizers: awsx.apigateway.getTokenLambdaAuthorizer({
            authorizerName: "jwt-rsa-custom-authorizer-post",
            header: "Authorization",
            handler: authorizerLambda,
            identityValidationExpression: "^Bearer [-0-9a-zA-Z\._]*$",
            authorizerResultTtlInSeconds: 3600,
        }),
    }],
    gatewayResponses: {
        DEFAULT_4XX: {
          statusCode: 400,
          responseTemplates: {
            'application/json': '{"message":$context.error.messageString}',
          },
          responseParameters: {
            'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
            'gatewayresponse.header.Access-Control-Allow-Headers': "'*'",
            'gatewayresponse.header.Access-Control-Allow-Methods': "'*'",
            'gatewayresponse.header.Access-Control-Allow-Credentials': "'*'",
          },
        },
        DEFAULT_5XX: {
            statusCode: 500,
            responseTemplates: {
              'application/json': '{"message":$context.error.messageString}',
            },
            responseParameters: {
              'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
              'gatewayresponse.header.Access-Control-Allow-Headers': "'*'",
              'gatewayresponse.header.Access-Control-Allow-Methods': "'*'",
              'gatewayresponse.header.Access-Control-Allow-Credentials': "'*'",
            },
        },
        UNAUTHORIZED: {
            statusCode: 419,
            responseTemplates: {
              'application/json': '{"message":$context.error.messageString}',
            },
            responseParameters: {
              'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
              'gatewayresponse.header.Access-Control-Allow-Headers': "'*'",
              'gatewayresponse.header.Access-Control-Allow-Methods': "'*'",
              'gatewayresponse.header.Access-Control-Allow-Credentials': "'*'",
            },
        },
        AUTHORIZER_FAILURE: {
            statusCode: 408,
            responseTemplates: {
              'application/json': '{"message":$context.error.messageString}',
            },
            responseParameters: {
              'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
              'gatewayresponse.header.Access-Control-Allow-Headers': "'*'",
              'gatewayresponse.header.Access-Control-Allow-Methods': "'*'",
              'gatewayresponse.header.Access-Control-Allow-Credentials': "'*'",
            },
        }
    }
});


// Export the URL for our API
export const apiUrl = api.stage.invokeUrl;

/**
 * Below is all code that gets added to the Authorizer Lambda. The code was copied and
 * converted to TypeScript from [Auth0's GitHub
 * Example](https://github.com/auth0-samples/jwt-rsa-aws-custom-authorizer)
 */

// Extract and return the Bearer Token from the Lambda event parameters
function getToken(event: awsx.apigateway.AuthorizerEvent): string {
    if (!event.type || event.type !== "TOKEN") {
        throw new Error('Expected "event.type" parameter to have value "TOKEN"');
    }

    const tokenString = event.authorizationToken;
    if (!tokenString) {
        throw new Error('Expected "event.authorizationToken" parameter to be set');
    }

    const match = tokenString.match(/^Bearer (.*)$/);
    if (!match) {
        throw new Error(`Invalid Authorization token - ${tokenString} does not match "Bearer .*"`);
    }
    return match[1];
}

// Check the Token is valid with Auth0
async function authenticate(event: awsx.apigateway.AuthorizerEvent): Promise<awsx.apigateway.AuthorizerResponse> {
    console.log(event);
    const token = getToken(event);

    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === "string" || !decoded.header || !decoded.header.kid) {
        throw new Error("invalid token");
    }

    const client = jwksClient({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10, // Default value
        jwksUri: jwksUri,
    });

    const key = await util.promisify(client.getSigningKey)(decoded.header.kid);
    const signingKey = key.getPublicKey();
    if (!signingKey) {
        throw new Error("could not get signing key");
    }

    const verifiedJWT = await jwt.verify(token, signingKey, { audience, issuer });
    if (!verifiedJWT || typeof verifiedJWT === "string" || !isVerifiedJWT(verifiedJWT)) {
        throw new Error("could not verify JWT");
    }
    return awsx.apigateway.authorizerResponse(verifiedJWT.sub, "Allow", event.methodArn);
}

interface VerifiedJWT {
    sub: string;
}

function isVerifiedJWT(toBeDetermined: VerifiedJWT | Object): toBeDetermined is VerifiedJWT {
    return (<VerifiedJWT>toBeDetermined).sub !== undefined;
}