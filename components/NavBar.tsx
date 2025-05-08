"use client";

import Image from "next/image";
import logo from "@/public/logo-5.png"; // замените на актуальный путь

export default function NavBar() {
  return (
    <div className="flex flex-row justify-center items-center w-full p-6">
      <Image src={logo} alt="Utlik Logo" height={140} />
    </div>
  );
}
