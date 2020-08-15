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
import styles from './OrderForm.css';
import {
  Container, Form
} from 'reactstrap';

// Build the order form and manage orders.
export function OrderForm(props) {
  // Form-related data
  const [firstName, setFirstName] = useState("First Name");
  const [lastName, setLastName] = useState("Last Name");
  const [phone, setPhone] = useState("630-555-1212");
  const [salutation, setSalutation] = useState("none");
  const [orderInfo, setOrderInfo] = useState("");
  const [submits, setSubmits] = useState(0);
  // Token data for interacting with the backend API
  //const [accessToken, setToken] = useState("");

  // Get domains, audiences, etc from environment variables
  const domain = process.env.REACT_APP_AUTH0_DOMAIN
  const clientId = process.env.REACT_APP_AUTH0_CLIENT_ID
  const audience = process.env.REACT_APP_AUTH0_AUDIENCE
  const backendUrl = process.env.REACT_APP_BACKEND_URL
  //const serviceUrl = process.env.REACT_APP_SERVICE_URL

  // using a free cors proxy
  const corsProxy = "https://cors-anywhere.herokuapp.com/"
  // build the base API URL with the cors proxy transversal
  const apiUri = corsProxy+backendUrl+"/customer"

  const {user, isAuthenticated} = useAuth0()

  /****** 
  // Should be run when the page is first set
  // useEffect() provides a mechanism to make async calls in render.
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
    console.log("getToken useEffect done");
  }, [isAuthenticated, domain, clientId, audience]); 
  *******/

  // Process the form with any data available from the backend DB 
  // The form is only available if the user was authenticated. 
  useEffect(() => {
    const processSubmit = async () => {
      /*
      setFirstName("First Name")
      setLastName("Last Name")
      setPhone("Phone Number")
      setSalutation("none")
      */

      // Get a fresh token
        const auth0 = await createAuth0Client({
          domain: domain,
          client_id: clientId
        })
        let token = ""
        try {
          token = await auth0.getTokenSilently({audience: audience});
          console.log("awaited token", token)
          //setToken(token)
        } catch (err) {
          console.log("token error", err)
        }

        // If first time in, get the current data for the user from the backend DB
        if ((typeof(user) !== 'undefined') && (submits === 0)) {
            const uri = apiUri+"?email="+user.email
            const user_fetch = await fetch(uri, {
              method: 'GET',
                headers: {
                    'X-Requested-With': 'corsproxy', // can be any value - needed for cors proxy
                    'Authorization': 'Bearer '+ token
                  }
            })
            const user_data = await user_fetch.json()	
            console.log("USER_DATA", JSON.stringify(user_data))
            if (user_data) {
              setFirstName(user_data.firstName)
              setLastName(user_data.lastName)
              setPhone(user_data.phone)
              setSalutation(user_data.salutation)
            } 
        } else if (submits > 0) {
          // Push data to DB backend
          const body = {
            "email": user.email,
            "lastName": orderInfo.lastName,
            "firstName": orderInfo.firstName,
            "phone": orderInfo.phone,
            "salutation": orderInfo.salutation,
          }
          console.log("Body", JSON.stringify(body))
          const uri = apiUri
            const user_fetch = await fetch(uri, {
              method: 'POST',
                headers: {
                    'X-Requested-With': 'corsproxy', // can be any value - needed for cors proxy
                    'Authorization': 'Bearer '+ token
                  },
                body: JSON.stringify(body)
            })
            const user_data = await user_fetch.json()	
            console.log("USER_DATA", JSON.stringify(user_data))
        }
    }
    processSubmit();
  }, [submits,orderInfo,apiUri,audience,clientId,domain,user]); //,[submits, firstName, lastName, phone, salutation, domain, audience, clientId, apiUri, user]); // the submitted value is used as a flag 

  // Processes the form when the user hits submit.
  const handleSubmit = (evt) => {
    evt.preventDefault();
    console.log("handleSubmit",JSON.stringify(evt))
    setOrderInfo("goo")
    if (user.email_verified === false) {
      alert(user.email+' needs to be verified before placing order. Check your email for verification link.')
    } else {
      const newsub = submits+1
      setSubmits(newsub) //keep track of number of submissions
      const address = (salutation ? salutation : "");
      alert(`${address} ${lastName}, your order has been placed..`)
    }
  }

  // Build the order form once the user has logged in.
  return (
    isAuthenticated && (
    <Container className={styles.form}>
    <Form onSubmit={()=>
      setOrderInfo({
        firstNane: firstName,
        lastName: lastName,
        phone: phone,
        salutation: salutation
      })
    }>
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
    </Form>
    </Container>
  )
  )
}

export default OrderForm;