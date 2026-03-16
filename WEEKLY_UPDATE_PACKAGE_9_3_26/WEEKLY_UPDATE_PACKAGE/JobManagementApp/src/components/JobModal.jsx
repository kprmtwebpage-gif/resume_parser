import { useState, useEffect } from 'react';
import Dropdown from './Dropdown';
import Autocomplete from './Autocomplete';
import RichTextEditor from './RichTextEditor';

const JobModal = ({ isOpen, onClose, onSave, job, mode }) => {
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    logo: '',
    location: '',
    department: '',
    employmentType: '',
    category: '',
    skills: '',
    qualification: '',
    description: '',
    comments: '',
    salaryStart: '',
    salaryEnd: '',
    currency: 'USD',
    priority: 'Normal',
    status: 'New',
    numberOfPositions: 1
  });

  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (job) {
      setFormData(job);
    } else {
      setFormData({
        title: '',
        company: '',
        logo: '',
        location: '',
        department: '',
        employmentType: '',
        category: '',
        skills: '',
        qualification: '',
        description: '',
        comments: '',
        salaryStart: '',
        salaryEnd: '',
        currency: 'USD',
        priority: 'Normal',
        status: 'New',
        numberOfPositions: 1
      });
    }
    setErrors({});
    setIsDirty(false);
    setShowConfirm(false);
  }, [job, isOpen]);

  const locationOptions = [
    'New York, USA',
    'Los Angeles, USA',
    'Chicago, USA',
    'Dallas, USA',
    'Florida, USA',
    'Remote'
  ];

  const departmentOptions = [
    'Tech',
    'Analytics',
    'Functional',
    'Marketing',
    'Product',
    'Design',
    'Support',
    'Sales',
    'Legal'
  ];

  const employmentTypeOptions = [
    'Full Time',
    'Part Time',
    'Contract',
    'Temporary',
    'Temp to Perm',
    'Volunteer',
    'Remote Work'
  ];

  const priorityOptions = ['High', 'Normal', 'Low'];

  const statusOptions = ['New', 'Assigned', 'In Progress', 'Needs Approval', 'Closed'];

  const categoryOptions = [
    'Systems Analyst',
    'Software Developer',
    'Database Administrator',
    'Web Developer',
    'Support Specialist',
    'Cloud Architect',
    'Project Manager',
    'Network Administrator',
    'Data Scientist',
    'Application Developer',
    'Cloud Engineer',
    'Programmer',
    'Data Quality Manager',
    'Front End Developer',
    'Back End Developer',
    'SQL Developer / DB Developer'
  ];

  const qualificationOptions = [
    'Bachelor\'s Degree',
    'Master\'s Degree',
    'Masters in Computer Science',
    'Masters in Information Technology',
    'Masters in Computer Information Systems',
    'B.Tech Computer Science',
    'B.Sc Computer Science',
    'MCA',
    'MBA IT',
    'PhD Computer Science'
  ];

  const currencyOptions = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'];

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleChange('logo', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.company.trim()) {
      newErrors.company = 'Company is required';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }

    if (!formData.employmentType) {
      newErrors.employmentType = 'Employment Type is required';
    }

    if (formData.salaryStart && formData.salaryEnd) {
      if (Number(formData.salaryStart) > Number(formData.salaryEnd)) {
        newErrors.salaryEnd = 'End salary must be greater than or equal to start salary';
      }
    }

    return newErrors;
  };

  const handleSubmit = () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(formData);
    setIsDirty(false);
    setShowConfirm(false);
    onClose();
  };

  const isReviewMode = mode === 'review';

  const handleDescriptionChange = (value) => {
    if (isReviewMode) return;
    handleChange('description', value);
    setIsDirty(true);
  };

  const handleCommentsChange = (e) => {
    if (isReviewMode) return;
    const nextValue = (e.target.value || '').slice(0, 100);
    handleChange('comments', nextValue);
    setIsDirty(true);
  };

  const handleCloseRequest = () => {
    if (!isReviewMode && isDirty) {
      setShowConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmSave = () => {
    setShowConfirm(false);
    handleSubmit();
  };

  const handleDiscard = () => {
    setShowConfirm(false);
    setIsDirty(false);
    onClose();
  };

  const commentLength = (formData.comments || '').length;

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleCloseRequest}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {job ? 'Edit Job' : 'Create Job'}
            {isReviewMode && <span className="read-only-badge">READ ONLY MODE</span>}
          </h2>
          <button className="modal-close" onClick={handleCloseRequest}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group-full">
            <label className="label">Job Title *</label>
            <input
              type="text"
              className="input"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="e.g. Senior Software Developer"
              disabled={isReviewMode}
            />
            {errors.title && <div style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px' }}>{errors.title}</div>}
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: '0 0 70%' }}>
              <label className="label">Company Name *</label>
              <input
                type="text"
                className="input"
                value={formData.company}
                onChange={(e) => handleChange('company', e.target.value)}
                placeholder="e.g. Tech Corp"
                disabled={isReviewMode}
              />
              {errors.company && <div style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px' }}>{errors.company}</div>}
            </div>
            <div className="form-group" style={{ flex: '0 0 30%' }}>
              <label className="label">Logo</label>
              <label className={`logo-upload ${isReviewMode ? 'disabled' : ''}`}>
                {formData.logo ? (
                  <img src={formData.logo} alt="Logo" className="logo-preview" />
                ) : (
                  <div className="logo-upload-text">
                    {isReviewMode ? 'No logo' : 'Click to upload'}
                  </div>
                )}
                {!isReviewMode && <input type="file" accept="image/*" onChange={handleLogoUpload} />}
              </label>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="label">Priority</label>
              <Dropdown
                value={formData.priority}
                onChange={(value) => handleChange('priority', value)}
                options={priorityOptions}
                placeholder="Select priority"
                disabled={isReviewMode}
              />
            </div>
            <div className="form-group">
              <label className="label">Status</label>
              <Dropdown
                value={formData.status}
                onChange={(value) => handleChange('status', value)}
                options={statusOptions}
                placeholder="Select status"
                disabled={isReviewMode}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="label">Location *</label>
              <Autocomplete
                value={formData.location}
                onChange={(value) => handleChange('location', value)}
                suggestions={locationOptions}
                placeholder="Start typing location..."
                disabled={isReviewMode}
              />
              {errors.location && <div style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px' }}>{errors.location}</div>}
            </div>
            <div className="form-group">
              <label className="label">Department</label>
              <Dropdown
                value={formData.department}
                onChange={(value) => handleChange('department', value)}
                options={departmentOptions}
                placeholder="Select department"
                disabled={isReviewMode}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="label">Number of Open Positions</label>
              <input
                type="number"
                className="input"
                value={formData.numberOfPositions}
                onChange={(e) => handleChange('numberOfPositions', Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                disabled={isReviewMode}
              />
            </div>
            <div className="form-group">
              <label className="label">Employment Type *</label>
              <Dropdown
                value={formData.employmentType}
                onChange={(value) => handleChange('employmentType', value)}
                options={employmentTypeOptions}
                placeholder="Select employment type"
                disabled={isReviewMode}
              />
              {errors.employmentType && <div style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px' }}>{errors.employmentType}</div>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: '0 0 30%' }}>
              <label className="label">Currency</label>
              <Dropdown
                value={formData.currency}
                onChange={(value) => handleChange('currency', value)}
                options={currencyOptions}
                disabled={isReviewMode}
              />
            </div>
            <div className="form-group">
              <label className="label">Salary Start</label>
              <input
                type="number"
                className="input"
                value={formData.salaryStart}
                onChange={(e) => handleChange('salaryStart', e.target.value)}
                placeholder="e.g. 50000"
                disabled={isReviewMode}
              />
            </div>
            <div className="form-group">
              <label className="label">Salary End</label>
              <input
                type="number"
                className="input"
                value={formData.salaryEnd}
                onChange={(e) => handleChange('salaryEnd', e.target.value)}
                placeholder="e.g. 80000"
                disabled={isReviewMode}
              />
              {errors.salaryEnd && <div style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px' }}>{errors.salaryEnd}</div>}
            </div>
          </div>

          <div className="form-group-full">
            <label className="label">Category</label>
            <Dropdown
              value={formData.category}
              onChange={(value) => handleChange('category', value)}
              options={categoryOptions}
              placeholder="Select category"
              searchable
              disabled={isReviewMode}
            />
          </div>

          <div className="form-group-full">
            <label className="label">Skills (comma separated)</label>
            <input
              type="text"
              className="input"
              value={formData.skills}
              onChange={(e) => handleChange('skills', e.target.value)}
              placeholder="e.g. JavaScript, React, Node.js"
              disabled={isReviewMode}
            />
          </div>

          <div className="form-group-full required-qualification">
            <label className="label">Required Qualification</label>
            <Autocomplete
              value={formData.qualification}
              onChange={(value) => handleChange('qualification', value)}
              suggestions={qualificationOptions}
              placeholder="Start typing qualification..."
              disabled={isReviewMode}
            />
          </div>

          <div className="form-group-full job-description">
            <label className="label">Job Description</label>
            <RichTextEditor
              value={formData.description}
              onChange={handleDescriptionChange}
              disabled={isReviewMode}
            />
          </div>

          <div className="form-group-full comments-field">
            <label className="label">Comments</label>
            <textarea
              className="input comments-textarea"
              value={formData.comments}
              onChange={handleCommentsChange}
              maxLength={100}
              placeholder="Add comments here..."
              disabled={isReviewMode}
            />
            <div className="comments-counter">{commentLength} / 100</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleCloseRequest}>
            {isReviewMode ? 'Close' : 'Cancel'}
          </button>
          {!isReviewMode && (
            <button className="btn btn-primary" onClick={handleSubmit}>
              Save Job
            </button>
          )}
        </div>
        {showConfirm && (
          <div className="confirm-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-dialog">
              <h3 className="confirm-title">Unsaved changes</h3>
              <p className="confirm-message">You have unsaved changes. Do you want to save before closing?</p>
              <div className="confirm-actions">
                <button className="btn btn-primary" onClick={handleConfirmSave}>
                  Save Changes
                </button>
                <button className="btn btn-danger" onClick={handleDiscard}>
                  Discard
                </button>
                <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobModal;
