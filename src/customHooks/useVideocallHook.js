import { useEffect, useState } from "react";

const useVideocallHook = () => {
  const [isRegisterd, setIsRegisterd] = useState(false);
let videocall = false;


  const registerUsername = (username) => {
    if (username === "") {
      alert("Insert a username to register (e.g., pippo)");
    } else {
      console.log(username);
      var register = { request: "register", username: username };
      console.log('videocall ', videocall);
      videocall.send({ message: register });
      setIsRegisterd(true);
    }
  };

  useEffect(() => {});
  return { isRegisterd, registerUsername, setIsRegisterd, videocall };
};

export default useVideocallHook;
