import React from "react";
import { TailSpin } from "react-loader-spinner"

const LoadingSpinner = () => (
  <TailSpin
    height="80"
    width="80"
    color="#a2faa3"
    ariaLabel="tail-spin-loading"
    radius="1"
    wrapperStyle={{}}
    wrapperClass=""
    visible={true}
  />
)

export default LoadingSpinner;
