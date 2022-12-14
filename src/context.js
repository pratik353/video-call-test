import React, { createContext, useRef, useEffect, useState } from "react";

const Context = createContext();

const ContextProvider = ({ children }) => {
  const [isRegister, setIsRegister] = useState(false)


    const registerUsername = (username) => {
        console.log(username);
        setIsRegister(true)
    } 

  return (
    <Context.Provider
      value={{
        registerUsername, isRegister
      }}
    >
      {children}
    </Context.Provider>
  );
};

export { ContextProvider, Context };
