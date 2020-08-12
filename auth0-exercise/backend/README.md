# Backend API 
Uses Pulumi to stand up an API gateway, Lambda to process the API requests, and DynamoDB to store the data.

# Stored Data
For each customer the following information is stored:
* email (DB key): (string) Customer Email Address
* firstName: (string) Customer First Name
* lastName: (string) Customer Last Name
* phone: (string) Customer Phone Number
* gender: (string) Customer Gender
* googleConns: (integer) Customer Google Connections Count

# API Specification
* GET /customers
  * Returns all customers
* GET /customers/{CustomerEmail}
  * Returns data for given customer
* POST /customers
  * Stores the data for the given customer given in the body.
  * See Data section above for fields and values.
* DELETE /customer/{CustomerEmail}
  * Removes given customer