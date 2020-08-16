/*
 * Handles the pizza order form and related interactions with Auth0 and backend APIs.
 * Main functions taken:
 * - Build the order form once the user is authenticated.
 * - Prepopulate the order form with any existing data known about the user.
 * - Update the backend DB when the form is submitted (regardless of whether or not verified).
 * - Only process an order if the user is verified.
 *   In the context of this app, processing an order means pushing the order to the backend DB where it is stored with a timestamp.
 */

import React, { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import createAuth0Client from '@auth0/auth0-spa-js';
import styles from './OrderForm.css';
import Loading from './components/Loading'
import {
  Container, Form
} from 'reactstrap';

// Get domains, audiences, etc from environment variables
const domain = process.env.REACT_APP_AUTH0_DOMAIN
const clientId = process.env.REACT_APP_AUTH0_CLIENT_ID
const audience = process.env.REACT_APP_AUTH0_AUDIENCE
const backendUrl = process.env.REACT_APP_BACKEND_URL

// Build the order form and manage orders.
const OrderForm = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [salutation, setSalutation] = useState("none");
  const [pizzaSize, setPizzaSize] = useState("small");
  const [pizzaFlavor, setPizzaFlavor] = useState("cheese");
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [firstTime, setFirstTime] = useState(true);

  //const {user, isAuthenticated} = useAuth0()
  const {user,isAuthenticated} = useAuth0()

  // Process the form with any data available from the backend DB.
  useEffect(() => {
    const processSubmit = async () => {
      // Using a free cors proxy to deal with CORS challenges between front and back ends.
      // Production would deploy front and backend with same domain.
      const corsProxy = "https://cors-anywhere.herokuapp.com/"
      // Build the base API URL with the cors proxy transversal inserted in there.
      const apiUri = corsProxy+backendUrl+"/customer"
 
      // If this is the first time here since the user authenticated,
      // go and grab any data we have in the backend to prepopulate the form.
      if (isAuthenticated && firstTime) {
        setFirstTime(false)
        setIsLoading(true); // show spinny circle thing while data is collected.
        if (!user.email_verified) {
          alert(`NOTE: You cannot place an order until you verify your email, ${user.email}. Check your email for verification link.`)
        }

        console.log("Getting data for", user.email)

        // Get a fresh Auth0 token to call the backend.
        const auth0 = await createAuth0Client({
          domain: domain,
          client_id: clientId
        })
        let token = ""
        try {
          token = await auth0.getTokenSilently({audience: audience});
        } catch (err) {
          console.log("token error", err)
        }

        // Call backend API to get user info if available
        try {
          const uri = apiUri+"?email="+user.email;
          const user_fetch = await fetch(uri, {
            method: 'GET',
              headers: {
                  'X-Requested-With': 'corsproxy', // can be any value - needed for cors proxy
                  'Authorization': 'Bearer '+ token
                }
          })
          const user_data = await user_fetch.json()	
          console.log("BACKEND USER_DATA", JSON.stringify(user_data))
        ///// Check if we have any good data from the backend
        /////if (typeof(user_data.email) !== 'undefined') {
          // Then we found someone, so fill in what we can
          if (typeof(user_data.firstName) !== 'undefined') {
            setFirstName(user_data.firstName)
          }
          if (typeof(user_data.lastName) !== 'undefined') {
            setLastName(user_data.lastName)
          }
          if (typeof(user_data.phone) !== 'undefined') {
            setPhone(user_data.phone)
          }
          if (typeof(user_data.salutation) !== 'undefined') {
            setSalutation(user_data.salutation)
          }
        } catch {
          console.log("User, "+user.email+", not found in backend DB.")
        }
        setIsLoading(false)
      }

      // This is where we go if the user hits the submit button
      if (submitted) {
        setSubmitted(false); //reset for next time
        setIsLoading(true); // spinny thingy

        // Build data to push to the DB backend regardless of whether verified
        // But only send fields that have values entered.
        let userInfo = {
          "email": user.email,
          "subId": user.sub,
          "salutation": salutation,
          "lastName": lastName,
          "firstName": firstName,
          "phone": phone
        }

        // Will be used to push data to the DB
        let payload = {};

        /* 
         * Two things happen when the user hits submit and is a verified user:
         * - An order object is created to be stored in the backend DB for the current time.
         * - A message it posted to indicate the pizza order is being processed.
         */
        if (user.email_verified) {
          // Build a date object of the form year_month_date to be used for storing the order in the DB.
          let now = new Date();
          let date = [ now.getFullYear(), (now.getMonth() + 1), now.getDate(), now.getHours(), now.getMinutes()]; 
          let dbDateKey = date.join(":");
          // Build a pizza order object to store in the DB.
          const pizzaOrder = {
            pizzaOrder: {
              orderDate: dbDateKey,
              order: {
                "pizzaSize": pizzaSize,
                "pizzaFlavor": pizzaFlavor
              }
            }
          }
          // Add the pizza order to the info being sent to the DB.
          payload = {
            ...userInfo,
            ...pizzaOrder
          }
          // Pretend we are actually doing something with this pizza order.
          alert(`Your ${pizzaSize} ${pizzaFlavor} pizza is being prepared. It will be ready in 20 minues.`) 
        } else {
          // User has to verify email before we'll take a pizza order.
          // But we'll store the information we have about the user.
          payload = userInfo
          alert(`Please, verify your email, ${user.email} before placing an order. Check your email for verification link.`)
        }

        // Send the user data and possibly the pizza order to the backend.
        // Get a fresh token
        const auth0 = await createAuth0Client({
          domain: domain,
          client_id: clientId
        })
        let token = ""
        try {
          token = await auth0.getTokenSilently({audience: audience});
        } catch (err) {
          console.log("token error", err)
        }

        // Build API to send data to the backend
        const uri = apiUri
          const user_fetch = await fetch(uri, {
            method: 'POST',
              headers: {
                  'X-Requested-With': 'corsproxy', // can be any value - needed for cors proxy
                  'Authorization': 'Bearer '+ token
                },
              body: JSON.stringify(payload)
          })
          const user_data = await user_fetch.json()	
          console.log("BACKEND USER_DATA", JSON.stringify(user_data))
          setIsLoading(false);
      }
    }
    processSubmit();
  }); 

  // Show loading spinny thing when waiting for stuff
  if (isLoading) {
    return <Loading />
  }

  // Build the order form once the user has logged in.
  const isEnabled = firstName.length > 0 && lastName.length > 0 && phone.length > 0;
  return (
    isAuthenticated && (
    <Container className={styles.form}>
    <Form onSubmit={event => {
      setSubmitted(true);
      event.preventDefault();
    }}>
      <label>
        Pizza Size:
        <select defaultValue={pizzaSize} onBlur={e => {setPizzaSize(e.target.value)}}> 
          <option value="large">Large</option>
          <option value="medium">Medium</option>
          <option value="small">Small</option>
        </select>
      </label>
      <label>
        Pizza Flavor:
        <select defaultValue={pizzaFlavor} onBlur={e => {setPizzaFlavor(e.target.value)}}> 
          <option value="sausage">Cheese and Sausage</option>
          <option value="pepperoni">Cheese and Pepperoni</option>
          <option value="cheese">Cheese Only</option>
        </select>
      </label>
      <label>
        Salutation:
        <select defaultValue={salutation} onBlur={e => { setSalutation(e.target.value)}}> 
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
          defaultValue={firstName}
          onChange={e => {
            setFirstName(e.target.value)
          }}
        />
      </label>
      <label>
        Last Name:
        <input
          type="text"
          defaultValue={lastName}
          onChange={e => {
            setLastName(e.target.value)
          }}
        />
      </label>
      <label>
        Phone Number:
        <input
          type="text"
          defaultValue={phone}
          onChange={e => {
            setPhone(e.target.value)
          }}
        />
      </label>

      <button disabled={!isEnabled}>Submit Order</button>
    </Form>
    </Container>
  )
  )
}

export default OrderForm;