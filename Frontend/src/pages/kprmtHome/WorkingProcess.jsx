import {
  IMG_WORKING_PROCESS_BG,
  IMG_STEP1_ICON,
  IMG_STEP2_ICON,
  IMG_STEP3_ICON,
  IMG_STEP4_ICON,
  IMG_PROCESS_VECTOR,
} from '../kprmtHomeImages'

const STEPS = [
  { num: '1', icon: IMG_STEP1_ICON, title: 'Strategy & Consulting', desc: 'Our experts will gather business requirement to understand the business needs.', alt: 'How it work' },
  { num: '2', icon: IMG_STEP2_ICON, title: 'Discovery & Roadmap', desc: 'Based on business needs, our creative team will discovery the solutions & propose roadmap to build it.', alt: 'Consulting' },
  { num: '3', icon: IMG_STEP3_ICON, title: 'Build', desc: 'The solution defined will be implemented and reviewed periodically to meet the requirement.', alt: 'Roadmap' },
  { num: '4', icon: IMG_STEP4_ICON, title: 'Sign Off', desc: 'Final sign off are made happily.', alt: 'Solution' },
]

export default function WorkingProcess() {
  return (
    <section className="working-prosess section-padding">
      <div className="container">
        <div className="row">
          <div className="col-12 col-xl-6 col-md-6 offset-md-3 text-center wow fadeInDown" data-wow-duration="1s" data-wow-delay="0.2s">
            <div className="section-title">
              <h5>How it work</h5>
              <h2>Check Out Our <br className="d-sm-mone d-block" /> Working Process</h2>
              <div className="yellow-bg">
                <img src={IMG_WORKING_PROCESS_BG} alt="Working Process" />
              </div>
            </div>
          </div>
        </div>
        <div className="row">
          {STEPS.map((step) => (
            <div key={step.num} className="col-12 col-xl-3 col-md-3 col-sm-6">
              <div className="single-working text-center">
                <div className="icon d-flex justify-content-center align-items-center">
                  <div className="img"><img src={step.icon} alt={step.alt} /></div>
                  <div className="number"><h6>{step.num}</h6></div>
                </div>
                <div className="content">
                  <h5>{step.title}</h5>
                  <p>{step.desc}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="vectore">
            <img src={IMG_PROCESS_VECTOR} alt="Sign Off" />
          </div>
        </div>
      </div>
    </section>
  )
}
