import React, { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";

export function OrderForm(props) {
  const [name, setName] = useState("");
  
  const handleSubmit = (evt) => {
      evt.preventDefault();
      if (user.email_verified === false) {
        alert(user.email+' needs to be verified before placing order. Check your email for verification link.')
      } else {
        alert(`${name}, your order has been placed..`)
      }
  }
  const {
    user,
    isAuthenticated,
  } = useAuth0()
  console.log("user", JSON.stringify(user))
  return (
    isAuthenticated && (
    <form onSubmit={handleSubmit}>
      <label>
        Frirst Name:
        <input
          type="text"
          value={name}
          onChange={e => {
            setName(e.target.value)
          }}
        />
      </label>
      <input type="submit" value="Submit" />
    </form>
  )
  )
}

export default OrderForm;