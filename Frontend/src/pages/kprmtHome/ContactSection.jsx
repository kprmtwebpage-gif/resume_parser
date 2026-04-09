import { useState } from 'react'
import { IMG_CAPTCHA } from '../kprmtHomeImages'

export default function ContactSection() {
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', subject: '', message: '', captcha: '',
  })
  const [formMessage, setFormMessage] = useState('')

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setFormMessage('Thank you! Your message has been sent.')
  }

  return (
    <div className="contact-us-wrapper" style={{ padding: '100px 0px' }} id="contact">
      <div className="container">
        <div className="row eq-height">
          <div className="col-lg-12">
            <h1 className="text-center" style={{ fontSize: '40px' }}>Contact Us</h1>
          </div>
          <div className="col-lg-8 col-12">
            <div className="contact-form">
              <h2>Get in Touch</h2>
              <form className="row" onSubmit={handleSubmit} id="contact-form">
                <div className="col-md-6 col-12">
                  <div className="single-personal-info">
                    <input type="text" name="name" placeholder="Name" id="name" required value={formData.name} onChange={handleChange} />
                  </div>
                </div>
                <div className="col-md-6 col-12">
                  <div className="single-personal-info">
                    <input type="email" name="email" placeholder="Email" id="email" required value={formData.email} onChange={handleChange} />
                  </div>
                </div>
                <div className="col-md-6 col-12">
                  <div className="single-personal-info">
                    <input type="text" name="phone" placeholder="Number" id="number" required value={formData.phone} onChange={handleChange} />
                  </div>
                </div>
                <div className="col-md-6 col-12">
                  <div className="single-personal-info">
                    <input type="text" name="subject" placeholder="Subject" id="f_subject" required value={formData.subject} onChange={handleChange} />
                  </div>
                </div>
                <div className="col-md-12 col-12">
                  <div className="single-personal-info">
                    <textarea name="message" placeholder="message" id="f_message" required value={formData.message} onChange={handleChange} />
                  </div>
                </div>
                <div>
                  <img src={IMG_CAPTCHA} id="captchaimg" alt="captcha" />
                </div>
                <div className="col-md-6 col-12">
                  <div className="single-personal-info">
                    <input type="text" name="captcha" placeholder="Captcha" id="captcha_code" required value={formData.captcha} onChange={handleChange} />
                  </div>
                </div>
                <div className="col-md-12 col-12">
                  <button className="submit-btn" type="submit" name="submit" id="contactBtn">Submit Now</button>
                </div>
              </form>
              {formMessage && <span className="form-message">{formMessage}</span>}
            </div>
          </div>
          <div className="col-lg-4 col-12">
            <div className="contact-us-sidebar mt-5 mt-lg-0">
              <div className="contact-info">
                <h2>CONTACT INFO</h2>
                <div className="single-info">
                  <div className="icon"><i className="flaticon-email" /></div>
                  <div className="text">
                    <span>Email Us</span>
                    <h5>contact@kprmt.com</h5>
                  </div>
                </div>
                <div className="single-info">
                  <div className="icon"><i className="flaticon-phone-call-1" /></div>
                  <div className="text">
                    <span>Call Us</span>
                    <h5>+1 (850) 800-2502</h5>
                  </div>
                </div>
                <div className="single-info">
                  <div className="icon"><i className="flaticon-pin" /></div>
                  <div className="text">
                    <span>HEADQUARTERS</span>
                    <h5>410 S Ware Blvd</h5>
                    <h5>Suite 812</h5>
                    <h5>Tampa, FL - 33619</h5>
                  </div>
                </div>
                <div className="single-info">
                  <div className="icon"><i className="flaticon-pin" /></div>
                  <div className="text">
                    <span>INDIA</span>
                    <h5>#480, 2nd Floor</h5>
                    <h5>Khiviraj Complex</h5>
                    <h5>Mount Road, Nandanam</h5>
                    <h5>Chennai, India, Tamil Nadu</h5>
                  </div>
                </div>
                <div className="single-info">
                  <div className="icon"><i className="flaticon-pin" /></div>
                  <div className="text">
                    <span>AUSTRALIA</span>
                    <h5>21 Calm Crescent</h5>
                    <h5>Springfield Lakes - 4300</h5>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
