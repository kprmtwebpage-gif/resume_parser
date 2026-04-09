import { IMG_EVERIFY, IMG_CALL_ICON } from '../kprmtHomeImages'
import { Link } from 'react-router-dom'

export default function KprmtFooter() {
  return (
    <footer className="footer-5">
      <div className="footer-cta-wrapper">
        <div className="container">
          <div className="footer-cta-bg-wrapper">
            <div className="row justify-content-around align-items-center p-0">
              <div className="col-lg-7 col-md-7 col-12">
                <div className="footer-middle-text text-white">
                  <h2>KPRMT is your trusted partner who puts on emphasis on Teamwork.</h2>
                </div>
              </div>
              <div className="col-lg-4 col-md-4 ps-lg-0 col-12">
                <div className="footer-btn d-flex justify-content-end align-items-center">
                  <div className="btn-wepper">
                    <a href="#contact" className="theme-btns">Contact Us</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-widgets-wrapper text-white">
        <div className="container">
          <div className="row">
            <div className="col-sm-6 col-md-6 col-xl-4 col-12">
              <div className="footer-site-info">
                <a href="#home"><h3>KPRMT</h3></a>
                <p className="pt-35 pb-35">We specialize in the Technology &amp; Healthcare industries, while also providing its tailored workforce solutions for a wide range of other industries.</p>
                <div className="logo" style={{ marginBottom: '20px' }}>
                  <div className="e-verify">
                    <img className="img-fluid wow pulse" data-wow-duration="1s" data-wow-delay="0s" src={IMG_EVERIFY} alt="E-verify" />
                  </div>
                </div>
                <div className="footer-social-icon text-lg-md-end">
                  <a href="https://www.linkedin.com/company/kprmt-global-solutions/posts/?feedView=all" target="_blank" rel="noopener noreferrer" style={{ marginLeft: '0px' }}>
                    <i className="fab fa-linkedin-in" />
                  </a>
                </div>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-md-3 col-xl-2 pl-xl-5 offset-xl-1">
              <div className="single-footer-wid">
                <div className="wid-title">
                  <h3>USEFUL LINKS</h3>
                </div>
                <ul>
                  <li><a href="#home">Home</a></li>
                  <li><a href="#about">About</a></li>
                  <li><a href="#services">Services</a></li>
                  <li><Link to="/job-search">Job Search</Link></li>
                  <li><a href="#contact">Contact</a></li>
                </ul>
              </div>
            </div>
            <div className="col-sm-6 col-xl-3 col-12 ps-xl-5 col-md-6">
              <div className="single-footer-contact single-footer-wid newsletter_widget style-2">
                <div className="wid-title">
                  <h3>Contact Info</h3>
                </div>
                <div className="contant-footer">
                  <div className="call d-flex align-items-start">
                    <div className="icon"><img src={IMG_CALL_ICON} alt="Call" /></div>
                    <div className="ms-4 call-num">
                      <p>+1 (850) 800-2502</p>
                    </div>
                  </div>
                  <div className="email d-flex align-items-start">
                    <div className="icon"><i className="fal fa-envelope" /></div>
                    <div className="ms-4 call-num">
                      <p>contact@kprmt.com</p>
                    </div>
                  </div>
                  <div className="location d-flex align-items-start">
                    <div className="icon"><i className="fal fa-map-marker-alt" /></div>
                    <div className="ms-4 call-num mt-0">
                      <p>410 S Ware Blvd <br />Suite 812 <br />Tampa FL - 33619</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container">
          <hr />
          <div className="row align-items-center py-4">
            <div className="col-md-6 col-12 text-center text-md-start">
              <div className="copyright-info">
                <p>&copy; 2024 Copyright By <a href="#home">KPRMT</a>. All Rights Reserved</p>
              </div>
            </div>
            <div className="col-md-6 col-12 text-center">
              <div className="footer-menu footer-menu-3 mt-3 mt-md-0 text-md-end">
                <ul>
                  <li><Link to="/privacy-policy" target="_top">Privacy Policy</Link></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
