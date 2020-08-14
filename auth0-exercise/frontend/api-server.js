const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const jwt = require("express-jwt");
const jwksRsa = require("jwks-rsa");

const app = express();

const domain = process.env.REACT_APP_AUTH0_DOMAIN;
const audience = process.env.REACT_APP_AUTH0_AUDIENCE;
const serviceUrl = process.env.REACT_APP_SERVICE_URL;

const port = process.env.API_PORT || 3001;
const appPort = process.env.SERVER_PORT || 3000;
const appOrigin = serviceUrl || `http://localhost:${appPort}`;

if (!domain || !audience) {
  throw new Error(
    "Please make sure that auth_config.json is in place and populated"
  );
}

app.use(morgan("dev"));
app.use(helmet());
app.use(cors({ origin: appOrigin }));

const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${domain}/.well-known/jwks.json`
  }),

  audience: audience,
  issuer: `https://${domain}/`,
  algorithm: ["RS256"]
});

app.get("/api/external", checkJwt, (req, res) => {
  res.send({
    msg: "Your access token was successfully validated!"
  });
});

app.listen(port, () => console.log(`API Server listening on port ${port}`));
