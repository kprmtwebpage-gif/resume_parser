import { useState } from 'react'

const FAQ_ITEMS = [
  {
    id: 'faq1',
    question: 'Improve Operational Efficiency',
    answer: 'Streamline operations and improve efficiency with our expert ERP process, technology and human capital advisement. We engineer your workforce to be flexible and high performing, now and for the future.',
  },
  {
    id: 'faq2',
    question: 'Increase Productivity & Reduce Costs',
    answer: 'Increase productivity & lower costs by leveraging technology, data & process design to eliminate organizational interruptions. Optimize your workforce based upon your unique short- and long-term needs.',
  },
  {
    id: 'faq3',
    question: 'Find the Right Talent for Your Needs & Culture',
    answer: 'Find the right candidates with the right skillsets who are the right fit for your company and values. This improves worker satisfaction, increases retention, builds culture, and lowers your overall cost-per-hire.',
  },
  {
    id: 'faq4',
    question: 'A Trusted Long-Term Partner You Can Rely On',
    answer: "Reduce stress and improve performance with a loyal, experienced partner who is always there for you in every situation. We're fast, flexible and responsive, and have extraordinary access to top national talent.",
  },
]

export default function FaqSection() {
  const [openId, setOpenId] = useState('faq1')

  const toggle = (id) => setOpenId(openId === id ? null : id)

  return (
    <section className="questionanswer section-padding">
      <div className="container">
        <div className="row align-items-center">
          <div className="col-12 col-xl-6 col-md-6 pr-40 wow fadeInDown" data-wow-duration="1s" data-wow-delay="0.2s">
            <div className="section-title">
              <h5>WHY KPRMT?</h5>
              <h2>Benefits of Working with <br />KPRMT Companies</h2>
              <div className="btn-wepper pt-5">
                <a href="#contact" className="theme-btns me-sm-4">Free Consultation</a>
              </div>
            </div>
          </div>
          <div className="col-12 col-xl-6 col-md-6">
            <div className="faq-content">
              <div className="faq-ask-list">
                <div className="accordion" id="accordionExample">
                  {FAQ_ITEMS.map((item) => (
                    <div key={item.id} className="accordion-item">
                      <h2 className="accordion-header" id={`${item.id}-header`}>
                        <button
                          className={`accordion-button${openId === item.id ? '' : ' collapsed'}`}
                          type="button"
                          onClick={() => toggle(item.id)}
                          aria-expanded={openId === item.id}
                          aria-controls={`${item.id}-panel`}
                        >
                          {item.question}
                        </button>
                      </h2>
                      <div
                        id={`${item.id}-panel`}
                        className={`accordion-collapse kp-accordion-panel${openId === item.id ? ' show' : ''}`}
                        aria-labelledby={`${item.id}-header`}
                      >
                        <div className="accordion-body">
                          <p>{item.answer}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
