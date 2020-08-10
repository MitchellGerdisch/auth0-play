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
import * as pulumi from "@pulumi/pulumi";

import * as jwt from "jsonwebtoken";
import * as jwksClient from "jwks-rsa";
import * as util from "util";

const config = new pulumi.Config();
const jwksUri = config.require("jwksUri");
const audience = config.require("audience");
const issuer = config.require("issuer");

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

// Create our API and reference the Lambda authorizer
/*
{
    "resource": "/customers",
    "path": "/customers",
    "httpMethod": "GET",
    "headers": null,
    "multiValueHeaders": null,
    "queryStringParameters": {
        "customerId": "12345"
    },
    "multiValueQueryStringParameters": {
        "customerId": [
            "12345"
        ]
    },
    ......
    */
const api = new awsx.apigateway.API("auth0-exercise-api", {
    routes: [{
        path: "/customers",
        method: "GET",
        eventHandler: async (event) => {
            console.log("request: " + JSON.stringify(event));
            return {
                statusCode: 200,
                body: "check lambda logs"
            };
        },
        authorizers: awsx.apigateway.getTokenLambdaAuthorizer({
            authorizerName: "jwt-rsa-custom-authorizer",
            header: "Authorization",
            handler: authorizerLambda,
            identityValidationExpression: "^Bearer [-0-9a-zA-Z\._]*$",
            authorizerResultTtlInSeconds: 3600,
        }),
    }],
});





 

// Export the URL for our API
export const url = api.url;

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