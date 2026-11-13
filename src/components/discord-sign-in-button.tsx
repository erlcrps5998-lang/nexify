"use client";
import {signIn} from "next-auth/react";
import {useState} from "react";

export default function DiscordSignInButton(){
  const [loading,setLoading]=useState(false);
  return <button type="button" className="primary" disabled={loading} onClick={async()=>{
    setLoading(true);
    try { await signIn("discord",{callbackUrl:"/dashboard"}); }
    catch { setLoading(false); }
  }}>{loading?"Connecting to Discord…":"Continue with Discord →"}</button>;
}
