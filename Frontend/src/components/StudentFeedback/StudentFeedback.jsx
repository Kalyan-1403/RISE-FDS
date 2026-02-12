import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import DeveloperCredit from '../DeveloperCredit/DeveloperCredit.jsx';
import './StudentFeedback.css';

const PARAMETERS = [
  'Knowledge of the subject',
  'Coming well prepared for the class',
  'Giving clear explanations',
  'Command of language',
  'Clear and audible voice',
  'Holding the attention of students through the class',
  'Providing more matter than in the textbooks',
  'Capability to clear the doubts of students',
  'Encouraging students to ask questions and participate',
  'Appreciating students as and when deserving',
  'Willingness to help students even out of the class',
  'Return of valued test papers/records in time',
  'Punctuality and following timetable schedule',
  'Coverage of syllabus',
  'Impartial (teaching all students alike)',
];

const StudentFeedback = () => {
  const { batchId } = useParams();
  const [batchData, setBatchData] = useState(null);
  const [ratings, setRatings] = useState({});
  const [comments, setComments] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    console.log('Loading batch:', batchId);

    const storedData = localStorage.getItem(`batch_${batchId}`);
    if (storedData) {
      const data = JSON.parse(storedData);
      console.log('✅ Batch data found:', data);
      setBatchData(data);
      setShowModal(true);
    } else {
      console.log('❌ Batch not found');
      alert('Invalid feedback link!');
    }
  }, [batchId]);

  const handleRatingChange = (paramIndex, subjectCode, value) => {
    setRatings((prev) => ({
      ...prev,
      [`${paramIndex}-${subjectCode}`]: value,
    }));
  };

  const determineCurrentSlot = (batchData) => {
    const feedbackCountKey = `batch_${batchId}_feedback_count`;
    const feedbackCount = parseInt(localStorage.getItem(feedbackCountKey) || '0');
    return feedbackCount < 30 ? 1 : 2;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const totalFields = PARAMETERS.length * batchData.faculty.length;
    const filledFields = Object.keys(ratings).length;

    if (filledFields < totalFields) {
      alert('⚠️ Please rate all parameters for all subjects');
      return;
    }

    const currentSlot = determineCurrentSlot(batchData);

    const feedbackData = {
      batchId,
      submittedAt: new Date().toISOString(),
      slot: currentSlot,
      responses: [],
    };

    batchData.faculty.forEach((fac) => {
      const facultyRatings = {};
      PARAMETERS.forEach((param, idx) => {
        const rating = ratings[`${idx}-${fac.code}`];
        facultyRatings[param] = parseInt(rating);
      });

      feedbackData.responses.push({
        facultyId: fac.id,
        facultyCode: fac.code,
        facultyName: fac.name,
        subject: fac.subject,
        year: fac.year,
        semester: fac.sem,
        section: fac.sec,
        ratings: facultyRatings,
        comments: comments,
      });
    });

    const existingFeedback = JSON.parse(localStorage.getItem('feedbackData') || '[]');
    existingFeedback.push(feedbackData);
    localStorage.setItem('feedbackData', JSON.stringify(existingFeedback));

    batchData.faculty.forEach((fac) => {
      const feedbackKey = `feedback_${fac.id}_${fac.year}_${fac.sem}`;
      const existingFacultyFeedback = JSON.parse(
        localStorage.getItem(feedbackKey) || '[]'
      );
      existingFacultyFeedback.push({
        slot: currentSlot,
        timestamp: new Date().toISOString(),
        ratings: PARAMETERS.reduce((acc, param, idx) => {
          acc[param] = parseInt(ratings[`${idx}-${fac.code}`]);
          return acc;
        }, {}),
        comments: comments,
      });
      localStorage.setItem(feedbackKey, JSON.stringify(existingFacultyFeedback));
    });

    const feedbackCountKey = `batch_${batchId}_feedback_count`;
    const currentCount = parseInt(localStorage.getItem(feedbackCountKey) || '0');
    localStorage.setItem(feedbackCountKey, (currentCount + 1).toString());

    console.log('✅ Feedback saved:', feedbackData);
    console.log(`Slot ${currentSlot} - Total responses for this batch: ${currentCount + 1}`);

    setSubmitted(true);
    setShowModal(false);
  };

  if (!batchData) {
    return (
      <div className="feedback-page">
        <div className="loading">Loading feedback form...</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="feedback-page">
        <div className="success-container">
          <div className="success-card">
            <div className="success-icon">✅</div>
            <h1>Thank You!</h1>
            <p>Your feedback has been submitted successfully.</p>
            <div className="batch-info">
              {batchData.dept} - Year {batchData.year} • Sem {batchData.sem} • Section{' '}
              {batchData.sec}
            </div>
          </div>
        </div>
        <DeveloperCredit />
      </div>
    );
  }

  return (
    <div className="feedback-page">
      {showModal && (
        <div className="feedback-modal-overlay">
          <div className="feedback-modal">
            <div className="modal-header">
              <div className="header-content">
                <h1>RISE Krishna Sai Prakasam Group of Institutions</h1>
                <h2>Valluru (V), Ongole (M), Prakasam (Dt)</h2>
                <h3>Feedback on Teaching and Learning</h3>
                <p className="form-title">
                  (To be filled by students at the end of the semester)
                </p>
              </div>
              <div className="meta-tags">
                <span>📚 {batchData.dept} Department</span>
                <span>🎓 Year {batchData.year}</span>
                <span>📖 Semester {batchData.sem}</span>
                <span>🏫 Section {batchData.sec}</span>
              </div>
            </div>

            <div className="modal-body">
              <div className="faculty-mapping-table">
                <h3>Subject - Faculty Mapping</h3>
                <table className="mapping-table">
                  <thead>
                    <tr>
                      <th className="code-cell">Subject Code</th>
                      <th className="name-cell">Faculty Name</th>
                      <th className="subject-cell">Subject</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchData.faculty.map((fac) => (
                      <tr key={fac.code}>
                        <td className="code-cell">{fac.code}</td>
                        <td className="name-cell">{fac.name}</td>
                        <td className="subject-cell">{fac.subject}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rating-info">
                <strong>Rating Scale:</strong> 10 = Outstanding • 9= Excellent • 8 = Very Good • 7 = Good • 6 = Above Average • 5 = Average • 4 = Fair • 3 = Below Average
                • 2 = Poor • 1 = Very Poor
              </div>

              <form onSubmit={handleSubmit}>
                <div className="feedback-table-wrapper">
                  <table className="feedback-table">
                    <thead>
                      <tr>
                        <th className="sno-col">S.No</th>
                        <th className="param-col">Parameters</th>
                        {batchData.faculty.map((fac) => (
                          <th key={fac.code} className="subject-col">
                            {fac.code}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PARAMETERS.map((param, idx) => (
                        <tr key={idx}>
                          <td className="center-text">{idx + 1}</td>
                          <td className="param-text">{param}</td>
                          {batchData.faculty.map((fac) => (
                            <td key={fac.code} className="rating-cell">
                              <select
                                className="rating-select"
                                value={ratings[`${idx}-${fac.code}`] || ''}
                                onChange={(e) =>
                                  handleRatingChange(idx, fac.code, e.target.value)
                                }
                                required
                              >
                                <option value="">Rate</option>
          <option value="1">1 - Very Poor</option>
          <option value="2">2 - Poor</option>
          <option value="3">3 - Below Average</option>
          <option value="4">4 - Fair</option>
          <option value="5">5 - Average</option>
          <option value="6">6 - Above Average</option>
          <option value="7">7 - Good</option>
          <option value="8">8 - Very Good</option>
          <option value="9">9 - Excellent</option>
          <option value="10">10 - Outstanding</option>
                              </select>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="comments-box">
                  <label>Additional Comments (Optional)</label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Share your thoughts, suggestions, or any other feedback..."
                  />
                </div>

                <div className="modal-footer">
                  <button type="submit" className="submit-btn">
                    Submit Feedback
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <DeveloperCredit />
    </div>
  );
};

export default StudentFeedback;
