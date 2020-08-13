import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import MyForm from "./MyForm";
import NavBar from "./NavBar";
//import * as serviceWorker from "./serviceWorker";
import { BrowserRouter } from "react-router-dom";
import Auth0ProviderWithHistory from "./auth0-provider-with-history";
//import { Nav } from "reactstrap";


ReactDOM.render(
  <BrowserRouter>,
      <Auth0ProviderWithHistory>
        <NavBar />
        <MyForm />
    </Auth0ProviderWithHistory>
 </BrowserRouter>,
  document.getElementById("root")
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
//serviceWorker.unregister();
