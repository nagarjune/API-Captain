import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import ApiDemo from "@/components/ApiDemo";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

const Index = () => {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get("section");
    if (!section) return;

    window.requestAnimationFrame(() => {
      const element = document.getElementById(section);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }, [location.search]);

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <Features />
      <ApiDemo />
      <CTA />
      <Footer />
    </main>
  );
};

export default Index;
