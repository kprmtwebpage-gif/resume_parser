import {
  IMG_TALENT_CONSULTING,
  IMG_WORKFORCE_BG,
  IMG_TRUSTED_PARTNER,
  IMG_CUSTOM_SOLUTIONS,
  IMG_HERO_STRATEGIC,
  IMG_HERO_SHAPES,
  IMG_SHAPE_ONE,
  IMG_SHAPE_TWO,
} from '../kprmtHomeImages'

export default function HeroSection() {
  return (
    <section className="agency-wrapper" id="home">
      <div className="it-wrapper">
        <div className="container">
          <div className="row">
            <div className="col-12 col-xl-6 col-md-6">
              <div className="banner-text">
                <h6>
                  TALENT | TECHNOLOGY | CONSULTING{' '}
                  <span>
                    <img src={IMG_TALENT_CONSULTING} alt="TALENT TECHNOLOGY CONSULTING" />
                  </span>
                </h6>
                <h1>Your Workforce Solutions<br /> Reimagined</h1>
                <div className="yellow-bg">
                  <img src={IMG_WORKFORCE_BG} alt="Workforce Solutions" />
                </div>
                <p>
                  KPRMT is a trusted partner of Fortune 500 companies providing strategic guidance
                  and custom solutions in the areas of staffing, technology &amp; managed workforce services.
                </p>
              </div>
              <div className="btn-wepper d-flex align-content-center">
                <div className="btn-head wow fadeInLeft" data-wow-duration="1s" data-wow-delay="1s">
                  <a href="#contact" className="theme-btns">Contact us</a>
                </div>
              </div>
            </div>
            <div className="col-12 col-xl-6 col-md-6 pb-md-5 position-relative">
              <div className="text-center">
                <img
                  className="expr-wepper-one img-fluid wow fadeInRight"
                  data-wow-duration="1s"
                  data-wow-delay="0.5s"
                  src={IMG_TRUSTED_PARTNER}
                  alt="Trusted Partner"
                />
                <img
                  className="expr-wepper-two img-fluid wow fadeInRight"
                  data-wow-delay="0.5s"
                  src={IMG_CUSTOM_SOLUTIONS}
                  alt="Custom Solutions"
                  style={{ visibility: 'visible', animationDelay: '0.5s', animationName: 'top-to-down' }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="hero-rapper wow fadeInRight" data-wow-duration="2s" data-wow-delay="0.7s">
          <img src={IMG_HERO_STRATEGIC} alt="Strategic" />
        </div>
        <div className="shapes">
          <img src={IMG_HERO_SHAPES} alt="Guidance" style={{ transform: 'translateY(-1.5cm)' }} />
        </div>
      </div>
      <div className="shape-one">
        <img src={IMG_SHAPE_ONE} alt="Managed" />
      </div>
      <div className="shape-two">
        <img src={IMG_SHAPE_TWO} alt="Consulting" style={{ transform: 'translateY(8cm)' }} />
      </div>
    </section>
  )
}
