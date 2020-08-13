import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
//import { Form } from "react-bootstrap";

const MyForm = () => { 

    const {
        //user,
        isAuthenticated,
        //loginWithRedirect,
        //logout,
      } = useAuth0()

     

    return(
        isAuthenticated && (
<form>
  <label>
    Name:
    <input type="text" name="name" />
  </label>
  <input type="submit" value="Submit" />
</form>
)
    );
}

export default MyForm;