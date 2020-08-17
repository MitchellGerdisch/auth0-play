# Auth0 Exercise
## How to Use
Once the back and front ends are up and running (see their respective READMEs), point your browser at the frontend's address.
From there, you can click the login button and login or sign up and "order a pizza."

## Front End
* The front-end comprises a node.js SPA.
* The main bits of code can be found in frontend/src/OrderForm.js
* However there is Auth0 magic in frontend/src/auth0-provider-with-history.js as well.

## Back End
* The back-end comprises an AWS API gateway, lambda functions (for authorization and API handling) and a DynamoDB.
* The pertinent code is in backend/pulumi/index.tx
  * Pulumi is being used to manage the infrastructure.
  * This includes the Lambda function logic for custom authorizers on the API gateway and Lambda functions to handle the APIs.
  * Additional details can be found in backend/README.md

# System set up
- Launch backend via pulumi script
  - see backend/pulumi README
- Launch frontend 
  - Can run via Amplify or locally - see frontend README