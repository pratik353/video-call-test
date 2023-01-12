import { BrowserRouter, Routes, Route } from "react-router-dom";

import MultiuserVideocall from "../src/components/MultiuserVideocall.jsx";

function App() {
  return (
    <>
      <h2 style={{ textAlign: "center" }}>CADIS-eziExpert-App</h2>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MultiuserVideocall />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
