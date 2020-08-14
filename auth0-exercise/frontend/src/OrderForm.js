/*
 * Handles the pizza order form and related interactions with the Auth0 and backend APIs.
 * Main functions taken:
 * - Build the order form once the user is authenticated.
 * - Prepopulate the order form with any existing data known about the user.
 * - Update the backend DB once the form is submitted (assuming the user is verified).
 */

import React, { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import createAuth0Client from '@auth0/auth0-spa-js';

// Build the order form and manage orders.
export function OrderForm(props) {
  // Form-related data
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [salutation, setSalutation] = useState("none");
  //const [order, setOrder] = useState("");
  const [submitted, setSubmitted] = useState(false);
  // Token data for interacting with the backend API
  const [accessToken, setToken] = useState("");

  // Get domains, audiences, etc from environment variables
  const domain = process.env.REACT_APP_AUTH0_DOMAIN
  const clientId = process.env.REACT_APP_AUTH0_CLIENT_ID
  const audience = process.env.REACT_APP_AUTH0_AUDIENCE
  const backendUrl = process.env.REACT_APP_BACKEND_URL
  const serviceUrl = process.env.REACT_APP_SERVICE_URL
  console.log("serviceUrl retrieved", serviceUrl)

  // Get auth0 data
  const {
    user,
    isAuthenticated,
  } = useAuth0()

  console.log("USER",JSON.stringify(user));

  // To interact with the APIs, we need to use async calls.
  // But render() doesn't allow async calls.
  // useEffect() provides a mechanism to make these async calls.
  useEffect(() => {
    async function getToken() {
      console.log("getToken")
      // Only want to try and get a token if user is authenticated
      if (isAuthenticated) {
        const auth0 = await createAuth0Client({
          domain: domain,
          client_id: clientId
        })
        try {
          // VERY IMPORTANT: You must pass the audience to getTokenSilently to get a proper token.
          const token = await auth0.getTokenSilently({audience: audience});
          console.log("awaited token", token)
          setToken(token)
        } catch (err) {
          console.log("token error", err)
        }
      }
      console.log("getToken done")
    }
    getToken()
    console.log("getToken useEffect done")
  }, [submitted, isAuthenticated, domain, clientId, audience]); // the submitted value is used as a flag to get a token.

  // Prepopulate the form with any data available from the backend DB
  useEffect(() => {
    async function setFormFields() {
      console.log("setFormFields")

      setFirstName("First Name")
      setLastName("Last Name")
      setPhone("Phone Number")
      setSalutation("none")

      // Get a fresh token
      if (isAuthenticated) {
        const auth0 = await createAuth0Client({
          domain: domain,
          client_id: clientId
        })
        try {
          const token = await auth0.getTokenSilently({audience: audience});
          console.log("awaited token", token)
          setToken(token)
        } catch (err) {
          console.log("token error", err)
        }

        // Get the current data for the user from the backend DB
        const uri = backendUrl+"/customer/"+user.email
        const user_fetch = await fetch(uri, {
          method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer '+ accessToken,
                'Access-Control-Allow-Origin': serviceUrl,
              }
        })
        const user_data = await user_fetch.json()	
        if (user_data) {
          setFirstName(user_data.firstName)
          setLastName(user_data.lastName)
          setPhone(user_data.phone)
          setSalutation(user_data.salutation)
        } 
      }
      console.log("setFormFields done")
    }
    setFormFields()
    console.log("setFormFields useEffect done")
  }, [isAuthenticated, user, domain, clientId, audience, accessToken, backendUrl]); // the submitted value is used as a flag to get a token.


  // Processes the form when the user hits submit.
  const handleSubmit = (evt) => {
      console.log("handleSubmit")
      evt.preventDefault();
      if (user.email_verified === false) {
        alert(user.email+' needs to be verified before placing order. Check your email for verification link.')
      } else {
        setSubmitted((submitted ? false : true))
        console.log("access token", accessToken)
        alert(`${salutation} ${lastName}, your order has been placed..`)
      }
  }

  // Build the order form once the user has logged in.
  return (
    isAuthenticated && (
    <form onSubmit={handleSubmit}>
      <label>
        Salutation:
        <select defaultValue={salutation} onChange={e => { setSalutation(e.target.value)}}> 
          <option value="Mr.">Mr.</option>
          <option value="Mrs.">Mrs.</option>
          <option value="Ms.">Ms.</option>
          <option value="none">None</option>
        </select>
      </label>
      <label>
        First Name:
        <input
          type="text"
          value={firstName}
          onChange={e => {
            setFirstName(e.target.value)
          }}
        />
      </label>
      <label>
        Last Name:
        <input
          type="text"
          value={lastName}
          onChange={e => {
            setLastName(e.target.value)
          }}
        />
      </label>
      <label>
        Phone Number:
        <input
          type="text"
          value={phone}
          onChange={e => {
            setPhone(e.target.value)
          }}
        />
      </label>

      <input type="submit" value="Submit" />
    </form>
  )
  )
}

export default OrderForm;