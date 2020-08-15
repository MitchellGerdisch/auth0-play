import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import OrderForm from "./OrderForm";
import NavBar from "./NavBar";
import { BrowserRouter } from "react-router-dom";
import Auth0ProviderWithHistory from "./auth0-provider-with-history";


ReactDOM.render(
  <BrowserRouter>,
      <Auth0ProviderWithHistory>
        <NavBar />
        <OrderForm />
    </Auth0ProviderWithHistory>
 </BrowserRouter>,
  document.getElementById("root")
);
