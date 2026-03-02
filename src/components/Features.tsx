import { Rocket, Shield, Gauge, Code2, GitBranch, Bell } from "lucide-react";

const features = [
  {
    icon: Rocket,
    title: "Lightning Fast Testing",
    description: "Execute API requests in milliseconds with our optimized engine. Support for REST, GraphQL, and WebSockets."
  },
  {
    icon: Shield,
    title: "Secure by Design",
    description: "End-to-end encryption for your API keys and secrets. SOC 2 compliant with enterprise-grade security."
  },
  {
    icon: Gauge,
    title: "Real-time Monitoring",
    description: "Track response times, error rates, and throughput. Get instant alerts when something goes wrong."
  },
  {
    icon: Code2,
    title: "Auto Documentation",
    description: "Generate beautiful API docs from your requests. Export to OpenAPI, Swagger, or custom formats."
  },
  {
    icon: GitBranch,
    title: "Version Control",
    description: "Built-in versioning for your API collections. Branch, merge, and collaborate with your team."
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description: "Get notified via Slack, Discord, or email. Custom alerts based on status codes and response times."
  }
];

const Features = () => {
  return (
    <section id="features" className="py-24 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-card-gradient opacity-50" />
      
      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Everything You Need to
            <br />
            <span className="text-gradient">Master Your APIs</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A complete toolkit for modern API development. From testing to monitoring, 
            we've got you covered.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-6 rounded-2xl bg-secondary/50 border border-border hover:border-primary/50 transition-all duration-300 hover:glow-accent"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="p-3 w-fit rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
