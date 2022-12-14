import { useEffect } from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { io } from "socket.io-client";
import MultiuserVideocall from "./components/MultiuserVideocall";
import RegisterUser from "./components/RegisterUser";

function App() {
  return (
    <>
      <h2 style={{textAlign :'center'}}>CADIS-eziExpert-App</h2>
      <Router>
        <Routes>
          <Route path="/" element={<MultiuserVideocall />} />
          <Route path="/:roomId" element={<MultiuserVideocall />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
