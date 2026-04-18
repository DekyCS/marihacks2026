import Nav from '@/components/landing/Nav';
import Hero from '@/components/landing/Hero';
import HowItWorks from '@/components/landing/HowItWorks';
import FAQ from '@/components/landing/FAQ';
import Footer from '@/components/landing/Footer';

export default function Landing() {
  return (
    <div className="page">
      <Nav />
      <Hero />
      <HowItWorks />
      <FAQ />
      <Footer />
    </div>
  );
}
