import { Link, Navigate } from 'react-router-dom';

import { LeafIcon } from '@/components/LeafIcon';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useAuth } from '@/hooks/use-auth';
import '@/App.css';
import '@/components/ui/ui.css';

const SHOPPER_FEATURES = [
  {
    index: '01',
    label: 'Discovery',
    title: 'Explore near you',
    body: 'Find farmers markets, private chefs, and local food businesses in your area — or browse popular makers nationwide.',
  },
  {
    index: '02',
    label: 'Following',
    title: 'Follow your favorites',
    body: 'Save vendors and chefs you love and get a personalized feed of updates, products, and booking announcements.',
  },
  {
    index: '03',
    label: 'Commerce',
    title: 'Order, reserve & book',
    body: 'Browse products, place reservations, book chef services, and pick up fresh goods from home cooks and cottage food vendors.',
  },
];

const VENDOR_FEATURES = [
  {
    index: '01',
    title: 'Your storefront',
    body: 'Customize your shop with a banner, logo, story, and links — all in one profile.',
  },
  {
    index: '02',
    title: 'Posts & updates',
    body: 'Share what is in season, market days, and specials with shoppers who follow you.',
  },
  {
    index: '03',
    title: 'Orders & analytics',
    body: 'Manage reservations, track sales, and connect Square POS when you are ready.',
  },
];

const PHILOSOPHY_PILLARS = [
  {
    index: '01',
    label: 'Community',
    title: 'Connect the community',
    body:
      'Vendorly brings local shoppers, private chefs, home cooks, and independent vendors into one place — so discovery, trust, and repeat business happen in your neighborhood, not across a dozen apps and social feeds.',
  },
  {
    index: '02',
    label: 'Revenue',
    title: 'Sell beyond market day',
    body:
      'Farmers markets are only a few hours a week. Vendorly helps makers capture their full sales potential with direct orders, chef bookings, and presale pickup — turning interest into revenue before and after the booth closes.',
  },
  {
    index: '03',
    label: 'Presence',
    title: 'One home for your business',
    body:
      'Vendors and chefs get a single storefront to promote every product, service, and update. Your catalog, your story, your schedule — everything shoppers need in one profile.',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Create your account',
    body: 'Sign up free on the web — same account works on mobile when the app launches.',
  },
  {
    step: '02',
    title: 'Choose your path',
    body: 'Shop local as a customer, sell as a vendor, or offer chef services in your community.',
  },
  {
    step: '03',
    title: 'Get connected',
    body: 'Discover markets, book private chefs, order from home kitchens, and grow your local food network.',
  },
];

function LandingNav() {
  return (
    <header className="nav">
      <div className="container nav__inner">
        <Link to="/" className="nav__brand">
          <span className="nav__icon" aria-hidden="true">
            <LeafIcon size={22} />
          </span>
          <Logo size="small" />
        </Link>

        <nav className="nav__links" aria-label="Main">
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <a href="#vendors">For vendors</a>
          <a href="#how-it-works">How it works</a>
        </nav>

        <div className="nav__actions">
          <ThemeToggle />
          <Link to="/login" className="btn btn--secondary nav__signin">
            Sign in
          </Link>
          <Link to="/signup" className="btn btn--primary nav__signup">
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}

export function LandingPage() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  }

  if (session) {
    return <Navigate to="/app" replace />;
  }

  return (
    <>
      <LandingNav />

      <main>
        <section className="hero">
          <div className="hero__bg" aria-hidden="true" />
          <div className="container hero__inner">
            <div className="hero__content">
              <p className="eyebrow">
                Vendorly Marketplace
                <span className="logo__tm" aria-hidden="true">
                  ™
                </span>
              </p>
              <h1 className="hero__title">
                Farmers markets.
                <br />
                <span className="hero__title-accent">Private chefs. Home cooks.</span>
              </h1>
              <p className="hero__lead">
                Discover, book, and order from makers near you — markets, chefs, and home kitchens
                in one app.
              </p>
              <div className="hero__actions">
                <Link to="/signup" className="btn btn--primary">
                  Sign up free
                </Link>
                <Link to="/login" className="btn btn--secondary">
                  Sign in
                </Link>
              </div>
            </div>

            <div className="hero__visual" aria-hidden="true">
              <div className="phone-mock">
                <div className="phone-mock__screen">
                  <div className="phone-mock__header">
                    <span className="phone-mock__leaf">
                      <LeafIcon size={18} />
                    </span>
                    <span className="phone-mock__brand">
                      <span className="phone-mock__logo">Vendorly</span>
                      <span className="phone-mock__logo-sub">
                        Marketplace
                        <span className="logo__tm" aria-hidden="true">
                          ™
                        </span>
                      </span>
                    </span>
                  </div>
                  <div className="phone-mock__tagline">Your local food marketplace</div>
                  <div className="phone-mock__chips">
                    <span>Markets</span>
                    <span className="active">Chefs</span>
                  </div>
                  <div className="phone-mock__cards">
                    <div className="phone-mock__card">
                      <div className="phone-mock__card-icon">🌾</div>
                      <div>
                        <strong>Saturday Market</strong>
                        <p>Downtown · This weekend</p>
                      </div>
                    </div>
                    <div className="phone-mock__card">
                      <div className="phone-mock__card-icon">👨‍🍳</div>
                      <div>
                        <strong>Chef Maria</strong>
                        <p>Meal prep · Private dining</p>
                      </div>
                    </div>
                    <div className="phone-mock__card">
                      <div className="phone-mock__card-icon">🥕</div>
                      <div>
                        <strong>Fresh Harvest Co.</strong>
                        <p>Home kitchen · Pickup ready</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="section section--about editorial-band">
          <div className="container">
            <div className="editorial-row">
              <p className="editorial-row__label">00 / Mission</p>
              <div className="editorial-row__copy">
                <h2>Built for local food, built for both sides</h2>
                <p>
                  Vendorly was created because local food deserves better than scattered listings
                  and a few market hours a week. We believe shoppers, chefs, and vendors thrive when
                  they are connected year-round — not just on Saturday morning.
                </p>
                <blockquote className="about__quote">
                  <p>
                    &ldquo;Markets bring people together. Vendorly keeps them together — helping
                    chefs, home cooks, and vendors sell their full output and giving shoppers one
                    trusted place to find, follow, and buy local.&rdquo;
                  </p>
                </blockquote>
              </div>
            </div>

            <div className="bento-grid bento-grid--mission">
              <article className="bento-card bento-card--wide">
                <p className="bento-card__label">
                  {PHILOSOPHY_PILLARS[0]!.index} / {PHILOSOPHY_PILLARS[0]!.label}
                </p>
                <h3>{PHILOSOPHY_PILLARS[0]!.title}</h3>
                <p>{PHILOSOPHY_PILLARS[0]!.body}</p>
              </article>
              <article className="bento-card bento-card--tall">
                <p className="bento-card__label">
                  {PHILOSOPHY_PILLARS[1]!.index} / {PHILOSOPHY_PILLARS[1]!.label}
                </p>
                <h3>{PHILOSOPHY_PILLARS[1]!.title}</h3>
                <p>{PHILOSOPHY_PILLARS[1]!.body}</p>
              </article>
              <article className="bento-card bento-card--span">
                <p className="bento-card__label">
                  {PHILOSOPHY_PILLARS[2]!.index} / {PHILOSOPHY_PILLARS[2]!.label}
                </p>
                <h3>{PHILOSOPHY_PILLARS[2]!.title}</h3>
                <p>{PHILOSOPHY_PILLARS[2]!.body}</p>
              </article>
            </div>
          </div>
        </section>

        <section id="features" className="section editorial-band">
          <div className="container">
            <div className="editorial-row">
              <p className="editorial-row__label">For shoppers</p>
              <div className="editorial-row__copy">
                <h2>Everything local, in your pocket</h2>
                <p>
                  Browse farmers markets on a map, book private chefs, order from home kitchens, and
                  reserve pickup without chasing down five different websites.
                </p>
              </div>
            </div>

            <div className="bento-grid bento-grid--features">
              {SHOPPER_FEATURES.map((feature, index) => (
                <article
                  key={feature.title}
                  className={`bento-card${index === 0 ? ' bento-card--wide' : ''}${index === 1 ? ' bento-card--tall' : ''}`}
                >
                  <p className="bento-card__label">
                    {feature.index} / {feature.label}
                  </p>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="vendors" className="section section--vendors editorial-band">
          <div className="container vendors__inner">
            <div className="vendors__copy">
              <p className="eyebrow">For vendors</p>
              <h2 className="section-title">Grow your local business</h2>
              <p className="section-lead">
                Vendorly gives independent makers and private chefs a storefront, a feed, and tools
                to manage orders — so you can focus on what you grow, bake, cook, and craft.
              </p>
              <Link to="/signup" className="btn btn--primary">
                Sign up as a vendor
              </Link>
            </div>

            <div className="vendors__cards">
              {VENDOR_FEATURES.map((feature) => (
                <article key={feature.title} className="vendors__feature">
                  <span className="vendors__feature-index">{feature.index}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="section section--honeydew editorial-band">
          <div className="container">
            <div className="editorial-row">
              <p className="editorial-row__label">How it works</p>
              <div className="editorial-row__copy">
                <h2>Three steps to get started</h2>
              </div>
            </div>

            <ol className="steps">
              {STEPS.map((item) => (
                <li key={item.step} className="steps__item">
                  <span className="steps__number">{item.step}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="get-started" className="section section--cta">
          <div className="container cta__inner">
            <div className="cta__icon" aria-hidden="true">
              <LeafIcon size={36} />
            </div>
            <h2 className="section-title cta__title">Ready to shop local?</h2>
            <p className="section-lead cta__lead">
              Create a free account or sign in to explore farmers markets, private chefs, and local
              food businesses on the web.
            </p>
            <div className="cta__stores">
              <Link to="/signup" className="store-badge" aria-label="Sign up for Vendorly">
                <span className="store-badge__small">New here?</span>
                <span className="store-badge__large">Sign up</span>
              </Link>
              <Link
                to="/login"
                className="store-badge store-badge--outline"
                aria-label="Sign in to Vendorly"
              >
                <span className="store-badge__small">Already have an account?</span>
                <span className="store-badge__large">Sign in</span>
              </Link>
            </div>
            <p className="cta__note">
              After signing in, you&apos;ll choose customer, vendor, or chef and enter the app.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__brand">
            <Logo variant="reversed" size="medium" showTagline />
          </div>

          <nav className="footer__links" aria-label="Footer">
            <a href="#about">About</a>
            <a href="#features">Features</a>
            <a href="#vendors">Vendors</a>
            <a href="#how-it-works">How it works</a>
            <Link to="/login">Sign in</Link>
            <Link to="/signup">Sign up</Link>
            <Link to="/legal/privacy">Privacy</Link>
            <Link to="/legal/terms">Terms</Link>
          </nav>

          <p className="footer__copy">
            &copy; {new Date().getFullYear()} Vendorly Marketplace&trade;. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  );
}
