# auth0 Exercise Frontend
- Runs as a node.js app.
- Can be run locally (npm start) or via AWS Amplify.

# Set Up 
- git clone
- npm install

# Run frontend service
## Locally
- Use set_env.sh script to set environment variables
- HTTPS=true npm start
- Confirm Auth0 Application Settings (https://auth0.com) point to https://IPADDRESS:3000 (as per the output of npm start)
- AVOID using localhost:3000 since that will affect the SPA's ability to get silent consent.

## Publicy
- You can use AWS Amplify by cloning the git repo into your own git repo.
  - Select the monorepo option and point down to frontend folder.
- As you are configuring the launch, be sure to select the Advanced options and set the environment variables as per set_env.sh.
  - Set environment variables locally or using Amplify
    - REACT_APP_AUTH0_DOMAIN="DOMAIN_FROM_AUTH0"
    - REACT_APP_AUTH0_CLIENT_ID="CLIENT_ID_FROM_AUTH0"
    - REACT_APP_AUTH0_AUDIENCE="AUDIENCE_FROM_AUTH0"
    - REACT_APP_BACKEND_URL="INVOKE_URL_FROM_API_GATEWAY_STAGE"


# Note about CORS
The frontend has a hard-coded cors-proxy in the code at this time (see the OrderForm module).
As much as the author tried, he could not get the API gateway and Amplify to play CORS nicely together. In the real world, the frontend and backend could use the same domain and the CORS challenges would go away.
