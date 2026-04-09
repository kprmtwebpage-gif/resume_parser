import {
  IMG_SERVICES_BG,
  IMG_MANAGED_CONSULTING,
  IMG_STAFFING_RECRUITING,
  IMG_INDUSTRY_SPEC,
} from '../kprmtHomeImages'

export default function ServicesSection() {
  return (
    <>
      <span id="services" style={{ display: 'block', position: 'relative', top: '-80px' }} />
      <section className="time-management-wepper section-padding" id="service">
        <div className="container">
          <div className="row">
            <div className="col-12 col-xl-12 mb-30 text-center wow fadeInDown" data-wow-duration="1s" data-wow-delay="0.2s">
              <div className="section-title">
                <h5>STAFFING &amp; IT CONSULTING SERVICES</h5>
                <h2 className="text-capitalize">Talent, Technology <br />&amp; Workforce Design</h2>
                <div className="yellow-bg">
                  <img src={IMG_SERVICES_BG} alt="STAFFING &amp; IT CONSULTING SERVICES" />
                </div>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-12 col-xl-4 col-md-4 col-sm-6 mt-30">
              <div className="management ps-4 pe-4 pt-4 rounded mang-1">
                <div className="content">
                  <div className="item d-flex justify-content-center align-items-center count-1">
                    <h3>1</h3>
                  </div>
                  <h3>Managed &amp; Consulting</h3>
                  <ul>
                    <li>👍 Strategic Advisory &amp; IT Consulting</li>
                    <li>👍 Enterprise Resource Planning (ERP)</li>
                    <li>👍 Process Re-Engineering</li>
                    <li>👍 Technology Implementation</li>
                    <li>👍 Enterprise Application Deployment</li>
                    <li>👍 Business Adoption</li>
                  </ul>
                  <div className="item-img text-center wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.2s">
                    <img src={IMG_MANAGED_CONSULTING} alt="Managed &amp; Consulting" />
                  </div>
                </div>
              </div>
            </div>
            <div className="col-12 col-xl-4 col-md-4 col-sm-6 mt-30">
              <div className="management ps-4 pe-4 pt-4 rounded mang-2">
                <div className="content">
                  <div className="item d-flex justify-content-center align-items-center count-2">
                    <h3>2</h3>
                  </div>
                  <h3>Staffing &amp; Recruiting</h3>
                  <ul>
                    <li>👍 Contract Staffing</li>
                    <li>👍 Direct Hire Staffing</li>
                    <li>👍 Temp, Permanent &amp; Contract-to-Hire</li>
                    <li>👍 Projects &amp; Teams</li>
                    <li>👍 Remote Work</li>
                    <li>👍 Executive Search</li>
                  </ul>
                  <div className="item-img text-center wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.3s">
                    <img src={IMG_STAFFING_RECRUITING} alt="Staffing &amp; Recruiting" />
                  </div>
                </div>
              </div>
            </div>
            <div className="col-12 col-xl-4 col-md-4 col-sm-6 mt-30">
              <div className="management ps-4 pe-4 pt-4 rounded mang-3">
                <div className="content">
                  <div className="item d-flex justify-content-center align-items-center count-3">
                    <h3>3</h3>
                  </div>
                  <h3>Industry Specializations</h3>
                  <ul>
                    <li>👍 Technology</li>
                    <li>👍 Healthcare</li>
                    <li>👍 Healthcare IT</li>
                    <li>👍 Finance &amp; Accounting</li>
                    <li>👍 Fintech</li>
                    <li>👍 Other Professional Verticals</li>
                  </ul>
                  <div className="item-img text-center wow fadeInUp" data-wow-duration="1s" data-wow-delay="0.4s">
                    <img src={IMG_INDUSTRY_SPEC} alt="Industry Specializations" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
