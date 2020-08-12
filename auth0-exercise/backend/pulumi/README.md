# Configuration and Setup Notes
- You will have created an API in Auth0 and under the quickstart it'll give the values for the following:
    - jwksUri
    - audience
    - issuer
- Set pulumi configuration with the values
    - pulumi config set --secret jwksUri <jwksURI>
    - pulumi config set --secret audience <audience>
    - pulumi config set --secret issuer <issuer>
- NOTE: If using: https://github.com/pulumi/examples/blob/master/aws-ts-apigateway-auth0/index.ts, you need to make the following change to the index.ts file:
    - Line 103 change "const signingKey = key.publicKey || key.rsaPublicKey" to "const signingKey = key.getPublicKey()"

- npm install

- pulumi up