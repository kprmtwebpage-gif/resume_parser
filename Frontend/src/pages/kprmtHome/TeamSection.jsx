import { IMG_TEAM_BG, IMG_TEAM_SHAPE } from '../kprmtHomeImages'

const MEMBERS = [
  { name: 'William John', role: 'Designer',   imgVar: '--sf-img-17', delay: '0.2s' },
  { name: 'Jara Khan',    role: 'UX/UI',      imgVar: '--sf-img-18', delay: '0.3s' },
  { name: 'Sorbo Met',    role: 'Developer',  imgVar: '--sf-img-19', delay: '0.4s' },
  { name: 'Mh.Nasim',    role: 'Front-end',  imgVar: '--sf-img-20', delay: '0.5s' },
]

export default function TeamSection() {
  return (
    <section className="team-member section-padding">
      <div className="container">
        <div className="row">
          <div className="col-12 col-xl-6 col-md-6 offset-md-3 text-center wow fadeInDown" data-wow-duration="1s" data-wow-delay="0.2s">
            <div className="section-title">
              <h5>skill member</h5>
              <h2>Meet Our Experience <br />Team Members</h2>
              <div className="yellow-bg">
                <img src={IMG_TEAM_BG} alt="skill member" />
              </div>
            </div>
          </div>
        </div>
        <div className="row">
          {MEMBERS.map((member) => (
            <div key={member.name} className="col-12 col-md-4 col-xl-3 col-sm-6">
              <div className="single-member wow fadeInUp" data-wow-duration="1s" data-wow-delay={member.delay}>
                <div
                  className="team-member bg-cover bg-center"
                  style={{ backgroundImage: `var(${member.imgVar})` }}
                />
                <div className="hoverly text-center">
                  <div
                    className="team-member-photo bg-cover bg-center"
                    style={{ backgroundImage: `var(${member.imgVar})` }}
                  />
                  <div className="content">
                    <h3>{member.name}</h3>
                    <p>{member.role}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="shaps">
        <img src={IMG_TEAM_SHAPE} alt="Front-end" style={{ transform: 'translateY(8cm)' }} />
      </div>
    </section>
  )
}
