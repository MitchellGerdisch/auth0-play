import React, { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import createAuth0Client from '@auth0/auth0-spa-js';


export function OrderForm(props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [salutation, setSalutation] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const {
    user,
    isAuthenticated,
  } = useAuth0()

  const [accessToken, setToken] = useState("");
  
    useEffect(() => {
      async function fetchData() {
        if (isAuthenticated) {
          const auth0 = await createAuth0Client({
            domain: process.env.REACT_APP_AUTH0_DOMAIN,
            client_id: process.env.REACT_APP_AUTH0_CLIENT_ID
          })
          try {
            const token = await auth0.getTokenSilently({audience: process.env.REACT_APP_AUTH0_AUDIENCE});
            console.log("awaited token", token)
            setToken(token)
          } catch (err) {
            console.log("token error", err)
          }
        }
      }
      fetchData()
    }, [submitted, isAuthenticated]);

  
  const handleSubmit = (evt) => {
      evt.preventDefault();
      if (user.email_verified === false) {
        alert(user.email+' needs to be verified before placing order. Check your email for verification link.')
      } else {
        setSubmitted((submitted ? false : true))
        console.log("access token", accessToken)
        alert(`${salutation} ${lastName}, your order has been placed..`)
      }
  }



  return (
    isAuthenticated && (
    <form onSubmit={handleSubmit}>
      <label>
        Salutation:
        <select onChange={e => { setSalutation(e.target.value)}}> 
          <option value="Mr.">Mr.</option>
          <option value="Mrs.">Mrs.</option>
          <option value="Ms.">Ms.</option>
          <option selected value="none">None</option>
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