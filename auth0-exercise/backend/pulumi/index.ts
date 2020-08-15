/*
 * WHAT IS CREATED
 * This file creates:
 * - API gateway, 
 * - customized authorizer Lambda function that uses Auth0
 * - Lambda function that handles the API requests
 * - DynamoDB for the backend database
 * 
 * INITIAL SETUP
 * 1) Auth0: Create API
 * 2) Go to quickstart and select node.js
 * 3) Note the jwksUri, audience, issuer and create pulumi config set --secret for these:
 *    e.g. pulumi config set --secret issuer https://goo.auth0.com
 * 
 * TESTING with POSTMAN
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
 * Using the API:
 * 1) Look at API gateway in AWS and got to the stage and copy the URL
 * 2) Create a GET to that URL/<resoruce> (e.g. https://URL/customers)
 * 3) Set Authorization Token to the ACCESS_TOKEN returned by the authentication above.
 * 4) Run the GET and you should see output commensurate with the event handler code below.
 */



import * as awsx from "@pulumi/awsx";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as AWS from "aws-sdk";

import * as jwt from "jsonwebtoken";
import * as jwksClient from "jwks-rsa";
import * as util from "util";
//import * as authenticate from "authLib";

const config = new pulumi.Config();
const jwksUri = config.require("jwksUri");
const audience = config.require("audience");
const issuer = config.require("issuer");

// Create DynamoDB table to store the customer information
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
    ttl: {
        attributeName: "TimeToExist",
        enabled: false,
    },
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

// Gets specific customer data from DB 
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

    // get the DB entry
    const tableItem = await dbClient.delete(dbParams, function(err, data) {
        if (err) {
            console.log("DB REMOVE ERROR",err);
        } else {
            console.log("DB REMOVE SUCCESS", data);
        };
    }).promise();
    return tableItem;
}

// Adds specific customer data to DB 
async function addCustomer(dbName: string, customerData: {email: string}) {
    const dbClient = new AWS.DynamoDB.DocumentClient();
    // DynamoDB entry
    let dbParams = {
        Item: customerData,
        TableName: dbName,
    }
    console.log("PUSH dbParams",dbParams)

    // push the DB entry
    const tableItem = await dbClient.put(dbParams, function(err, data) {
        if (err) {
            console.log("DB PUSH ERROR",err);
        } else {
            console.log("DB PUSH SUCCESS", data);
        };
    }).promise();
    return getCustomer(dbName, customerData.email);
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