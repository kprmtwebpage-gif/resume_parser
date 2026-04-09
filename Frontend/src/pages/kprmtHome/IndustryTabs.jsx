import { useState } from 'react'
import {
  IMG_TAB_WORKFORCE,
  IMG_TAB_SOLUTIONS,
  IMG_TAB_MEDICAL,
  IMG_TAB_FINANCE,
} from '../kprmtHomeImages'

const TABS = [
  { label: 'Industry Specializations', icon: 'flaticon-notebook' },
  { label: 'Workforce Solution',       icon: 'flaticon-construction-tool-vehicle-with-crane-lifting-materials' },
  { label: 'Job Search',               icon: 'flaticon-operation' },
]

export default function IndustryTabs() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <>
      <span id="job-search" style={{ display: 'block', position: 'relative', top: '-80px' }} />
      <section className="our-info-tabs-wrapper" id="service">
        <div className="container">
          <div className="row">
            <div className="col-12 col-xl-12">
              <div className="project-tabs-wrapper">
                <ul className="nav nav-pills" id="pills-tab" role="tablist">
                  {TABS.map((tab, i) => {
                    const isActive = activeTab === i
                    const tabId = `pills-tab${i + 1}`
                    const panelId = `pills-tab-${i + 1}`

                    return (
                      <li key={tab.label} className="nav-item" role="presentation">
                        <button
                          id={tabId}
                          className={`nav-link${isActive ? ' active' : ''}`}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          aria-controls={panelId}
                          onClick={() => setActiveTab(i)}
                        >
                          <span className="kp-tab-btn-content">
                            <i className={tab.icon} aria-hidden="true" />
                            <span>{tab.label}</span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <div className="tab-content" id="pills-tabContent">
                  {/* Tab 1: Industry Specializations */}
                  <div id="pills-tab-1" className={`tab-pane kp-tab-panel${activeTab === 0 ? ' active' : ''}`} role="tabpanel" aria-labelledby="pills-tab1">
                    <div className="tab-content-wrapper">
                      <div className="row">
                        <div className="col-lg-6 col-12">
                          <h5>GUIDANCE, TALENT &amp; PROJECT MANAGEMENT</h5>
                          <h2>End-to-End Technology Support for Projects &amp; Companies of Every Size &amp; Scale</h2>
                          <p>For nearly three decades, KPRMT has been partnering with forward-thinking organizations to optimize their businesses using a tailored mix of customize technology, managed solutions, and advanced support from top IT talent and consultants. We not only provide clients with the right resources to help them succeed based on their unique needs but consult with them to help identify what those needs are and support their digital transformation.</p>
                        </div>
                        <div className="col-lg-6 col-12">
                          <div className="tab-img">
                            <img height="400" src={IMG_TAB_WORKFORCE} alt="WORKFORCE" />
                          </div>
                        </div>
                      </div>
                      <div className="row gap">
                        <div className="col-lg-6 col-12">
                          <div className="tab-img text-center">
                            <img height="300" src={IMG_TAB_SOLUTIONS} alt="SOLUTIONS" />
                          </div>
                        </div>
                        <div className="col-lg-6 col-12">
                          <h5>HEALTHCARE WORKFORCE SOLUTIONS</h5>
                          <h2>Industry Leading Healthcare Talent Specialists</h2>
                          <p>KPRMT helps healthcare organizations maximize their efficiency and effectiveness by providing comprehensive healthcare staffing solutions for both clinical and non-clinical needs. For over two decades, we&apos;ve been helping hospitals, acute care facilities, outpatient clinics and others design, build &amp; maintain their healthcare workforces.</p>
                        </div>
                      </div>
                      <div className="row gap">
                        <div className="col-lg-6 col-12">
                          <h5>HEALTHCARE IT SOLUTIONS</h5>
                          <h2>Trusted Healthcare Technology Specialists</h2>
                          <p>Today&apos;s healthcare organizations are rapidly evolving and complex. To run smoothly, they require integrated technology solutions and expert staff. KPRMT brings over three decades of healthcare IT consulting experience to meet client challenges. We help healthcare organizations design, develop, activate, and manage their health information systems, through advisory services, strategic solutions and staff augmentation.</p>
                        </div>
                        <div className="col-lg-6 col-12">
                          <div className="tab-img">
                            <img height="400" src={IMG_TAB_MEDICAL} alt="Medical" />
                          </div>
                        </div>
                      </div>
                      <div className="row gap">
                        <div className="col-lg-6 col-12">
                          <div className="tab-img text-center">
                            <img height="400" src={IMG_TAB_FINANCE} alt="Finance" />
                          </div>
                        </div>
                        <div className="col-lg-6 col-12">
                          <h5>FLEXIBLE FINANCIAL WORKFORCE SERVICES</h5>
                          <h2>Meeting the Demands of Today&apos;s Financial Services Industry</h2>
                          <p>It&apos;s no secret. The financial services industry today is a growing like never before. Driven by increased efficiencies resulting from the adoption of digitization and investments in big data, it is an engine for economic growth all over the world. As a result, competition is fierce for skilled financial and accounting industry talent. That&apos;s why leading financial institutions and Fortune 500 companies turn to KPRMT for its flexible, solutions-focused workforce services.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tab 2: Workforce Solution */}
                  <div id="pills-tab-2" className={`tab-pane kp-tab-panel${activeTab === 1 ? ' active' : ''}`} role="tabpanel" aria-labelledby="pills-tab2">
                    <div className="tab-content-wrapper">
                      <div className="row">
                        <div className="col-lg-6 col-12">
                          <h5>SUPPORTING ALL YOUR WORKFORCE NEEDS</h5>
                          <h2>A Managed Services Partner You Can Trust</h2>
                          <p>Large companies today face an increasing variety of complex workforce challenges. That&apos;s why KPRMT Companies provides end-to-end management of the contingent workforce. From strategic enterprise resource planning (ERP) and workforce design, to talent provision and analytics, we provide our partners with tailored solutions to support their evolving needs. Whether your staffing solutions call for temporary workers, consultants, contract workers or teams, for special projects or ongoing operations, we know what it takes to ensure success and provide three decades of experience delivering it.</p>
                        </div>
                        <div className="col-lg-6 col-12">
                          <div className="tab-img"><img height="400" src="/ws-img/support.png" className="img-fluid" alt="Support" /></div>
                        </div>
                      </div>
                      <div className="row gap">
                        <div className="col-lg-6 col-12">
                          <div className="tab-img text-center"><img height="300" src="/ws-img/tech.png" className="img-fluid" alt="Technology" /></div>
                        </div>
                        <div className="col-lg-6 col-12">
                          <h5>ALIGNING TECHNOLOGY, PROCESS &amp; TALENT</h5>
                          <h2>Full Lifecycle Custom Technology &amp; IT Solutions</h2>
                          <p>Talent is only one part of the formula for business success. Today, more than ever, technology, process and project management also play critical roles. The more closely these are aligned, the more efficient and effective your business will be. KPRMT Companies supports its clients with full lifecycle, customized technology and IT solutions to support their business demands. This includes process engineering, technology evaluation and implementation, application development, and the right professionals to always guide every aspect of it.</p>
                        </div>
                      </div>
                      <div className="row gap">
                        <div className="col-lg-6 col-12">
                          <h5>ON-DEMAND CONTRACT STAFFING</h5>
                          <h2>The Smart Way to Adapt to Changing Market Conditions</h2>
                          <p>We live in an era of rapidly changing market conditions. More than ever, employers need to be able to adapt their workforces to meet the requirements of these changes. KPRMT&apos;s contract staffing services provides businesses with the ability to manage their organizations more effectively by contracting out the right mix of temporary, permanent, and contract-to-hire talent to ensure optimal efficiency.</p>
                        </div>
                        <div className="col-lg-6 col-12">
                          <div className="tab-img"><img height="400" src="/ws-img/market.png" className="img-fluid" alt="Market" /></div>
                        </div>
                      </div>
                      <div className="row gap">
                        <div className="col-lg-6 col-12">
                          <div className="tab-img text-center"><img height="400" src="/ws-img/hire.png" className="img-fluid" alt="Hire" /></div>
                        </div>
                        <div className="col-lg-6 col-12">
                          <h5>PROFESSIONAL DIRECT HIRE SERVICES</h5>
                          <h2>Take Your Direct Hires to the Next Level</h2>
                          <p>When you&apos;re looking for the top talent to take your business to the next level, turn to KPRMT Companies for the best professional direct hire staffing services. With three decades of experience in outsourced staffing and recruiting including contract and direct placement services, we are a trusted resource for helping leading companies identify, recruit and retain the best and brightest talent.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tab 3: Job Search */}
                  <div id="pills-tab-3" className={`tab-pane kp-tab-panel${activeTab === 2 ? ' active' : ''}`} role="tabpanel" aria-labelledby="pills-tab3">
                    <div className="tab-content-wrapper">
                      <div className="row">
                        <div className="col-lg-6 col-12">
                          <h5>GETTING STARTED</h5>
                          <h2>Let&apos;s Take the Next Step in Your Career, Together</h2>
                          <p>KPRMT Companies is one of the nation&apos;s most respected workforce solutions firms. We provide expert consulting and talent placement services for Fortune 500 and other leading companies, nationwide including direct hire, contract staffing (temp &amp; perm), remote work, executive search, and more. We specialize in Technology / IT, Healthcare, Finance, and other professional roles. What does this mean for your job search? Opportunity. A chance to navigate your career in the way you envision it: who you work for, what you do, where you do it, and how you do it. Whether you are interested in joining our in-house team of consultants, prefer direct-hire placement, remote work, or something else, we are dedicated to understanding your unique goals and helping you achieve them.</p>
                        </div>
                        <div className="col-lg-6 col-12">
                          <div className="tab-img"><img height="400" src="/ws-img/job.png" className="img-fluid" alt="Job" /></div>
                        </div>
                      </div>
                    </div>
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
