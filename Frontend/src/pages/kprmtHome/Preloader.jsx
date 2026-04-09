export default function Preloader() {
  return (
    <div id="preloader" className="preloader">
      <div className="animation-preloader">
        <div className="spinner" />
        <div className="txt-loading">
          <span data-text-preloader="K" className="letters-loading">K</span>
          <span data-text-preloader="P" className="letters-loading">P</span>
          <span data-text-preloader="R" className="letters-loading">R</span>
          <span data-text-preloader="M" className="letters-loading">M</span>
          <span data-text-preloader="T" className="letters-loading">T</span>
        </div>
        <p className="text-center">Loading</p>
      </div>
      <div className="loader">
        <div className="row">
          <div className="col-3 loader-section section-left"><div className="bg" /></div>
          <div className="col-3 loader-section section-left"><div className="bg" /></div>
          <div className="col-3 loader-section section-right"><div className="bg" /></div>
          <div className="col-3 loader-section section-right"><div className="bg" /></div>
        </div>
      </div>
    </div>
  )
}
