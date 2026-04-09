import {
  IMG_EXPERIENCE,
  IMG_LEAF_SHAPE,
  IMG_WHAT_WE_DO_BG,
  IMG_ABOUT_SHAPE_TWO,
  IMG_ABOUT_BOTTOM_SHAPE,
} from '../kprmtHomeImages'

export default function AboutSection() {
  return (
    <section className="experience-weeper" id="about">
      <div className="container">
        <div className="row">
          <div className="col-12 col-xl-6 col-md-6 pb-md-5 wow fadeInLeft" data-wow-duration="1s" data-wow-delay="0.2s">
            <div className="experience-weeper-brand">
              <div className="img-ex">
                <img src={IMG_EXPERIENCE} alt="exprence" />
              </div>
              <div className="shape shape-one">
                <img src={IMG_LEAF_SHAPE} alt="Leaf" />
              </div>
              <div className="count-item">
                <div className="single-fun-fact text-center">
                  <h2><span className="is-visible" style={{ visibility: 'visible' }}>11</span>+</h2>
                  <h3>Experience</h3>
                </div>
              </div>
            </div>
            <div className="shape-two">
              <img src={IMG_ABOUT_SHAPE_TWO} alt="" />
            </div>
          </div>
          <div className="col-12 col-xl-6 col-md-6">
            <div className="section-title-2 ps-xl-4 ml-40">
              <h5 className="wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.2s">WHAT WE DO</h5>
              <h1 className="wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.3s">
                We Empower Businesses with Solutions-Focused Workforce Services.
              </h1>
              <div className="yellow-bg wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.3s">
                <img src={IMG_WHAT_WE_DO_BG} alt="WHAT WE DO" />
              </div>
              <p className="wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.4s">
                Headquartered in Tampa, FL, KPRMT Companies partners with premiere organizations
                nationwide to deliver solutions-focused workforce services. One of the world&apos;s
                largest providers of HR services, we have the resources necessary to scale with any
                enterprise, yet are small enough to maintain the agility, personal service and
                remarkable experience we&apos;ve become known for over the past three decades. This is
                your workforce, and your business&hellip; reimagined.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="shape">
        <img src={IMG_ABOUT_BOTTOM_SHAPE} alt="" />
      </div>
    </section>
  )
}
