import Nav from './components/Nav';
import Hero from './components/Hero';
import Stats from './components/Stats';
import Problem from './components/Problem';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import Roles from './components/Roles';
import Integrations from './components/Integrations';
import Trust from './components/Trust';
import CTA from './components/CTA';
import Footer from './components/Footer';

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      <Nav />
      <Hero />
      <Stats />
      <Problem />
      <Features />
      <HowItWorks />
      <Roles />
      <Integrations />
      <Trust />
      <CTA />
      <Footer />
    </main>
  );
}
