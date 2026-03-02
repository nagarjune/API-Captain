import { Anchor, Menu, X } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Anchor className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold">
              API <span className="text-gradient">Captain</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/?section=features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link to="/?section=demo" className="text-muted-foreground hover:text-foreground transition-colors">
              Demo
            </Link>
            <Link to="/builder" className="text-muted-foreground hover:text-foreground transition-colors">
              Builder
            </Link>
            <Link to="/?section=docs" className="text-muted-foreground hover:text-foreground transition-colors">
              Docs
            </Link>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link to="/builder">Get Started</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            <div className="flex flex-col gap-4">
              <Link to="/?section=features" className="text-muted-foreground hover:text-foreground transition-colors py-2">
                Features
              </Link>
              <Link to="/?section=demo" className="text-muted-foreground hover:text-foreground transition-colors py-2">
                Demo
              </Link>
              <Link to="/builder" className="text-muted-foreground hover:text-foreground transition-colors py-2">
                Builder
              </Link>
              <Link to="/?section=docs" className="text-muted-foreground hover:text-foreground transition-colors py-2">
                Docs
              </Link>
              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                <Button variant="ghost" className="justify-start">
                  Sign In
                </Button>
                <Button variant="default">
                  Get Started
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
