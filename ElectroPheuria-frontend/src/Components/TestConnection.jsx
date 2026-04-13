import React, { useEffect, useState } from "react";
import axios from "axios";

function TestConnection() {
  const [response, setResponse] = useState("Loading...");

  useEffect(() => {
    axios.get("/api/test")
      .then(res => setResponse(res.data.message))
      .catch(err => {
        console.error(err);
        setResponse("Error connecting to Laravel");
      });
  }, []);

  return <div style={{ padding: "20px", fontWeight: "bold" }}>{response}</div>;
}

export default TestConnection;