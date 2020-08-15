# auth0-exercise Backend Service
Uses pulumi to deploy the following in AWS:
- API Gateway
- Lambda functions
  - For custome authorizers
  - For the backend API.
- DynamoDb

Leverages the information here: https://auth0.com/docs/integrations/aws-api-gateway-custom-authorizers 
and this pulumi example: https://github.com/pulumi/examples/blob/master/aws-ts-apigateway-auth0/index.ts
- Note if using the Pulumi example, you need to make the following change to the index.ts file:
    - Line 103 change "const signingKey = key.publicKey || key.rsaPublicKey" to "const signingKey = key.getPublicKey()"

# Configuration and Setup Notes
- Login to Auth0 and select quickstart for the API you created. 
- You will see values for the following items: 
    - jwksUri
    - audience
    - issuer
- Set pulumi configuration with the values
    - pulumi config set --secret jwksUri <jwksURI>
    - pulumi config set --secret audience <audience>
    - pulumi config set --secret issuer <issuer>
- npm install @types/jwks-rsa
- npm install

# Launch backend system
- pulumi up