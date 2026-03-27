import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import dataService from '../../services/dataService.js';
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
  const [batchData, setBatchData] =
    useState(null);
  const [ratings, setRatings] = useState({});
  const [facultyComments, setFacultyComments] =
    useState({});
  const [generalComments, setGeneralComments] =
    useState('');
  const [submitted, setSubmitted] =
    useState(false);
  const [showModal, setShowModal] =
    useState(false);
  const [loadError, setLoadError] =
    useState('');
  const [submitLoading, setSubmitLoading] =
    useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);

    const fetchBatchData = async () => {
      try {
        const batch =
          await dataService.getBatch(batchId);

        if (batch) {
          setBatchData(batch);
          const initialComments = {};
          if (
            batch.faculty &&
            batch.faculty.length > 0
          ) {
            batch.faculty.forEach((f) => {
              initialComments[f.code] = '';
            });
          }
          setFacultyComments(initialComments);
          setShowModal(true);
        } else {
          setLoadError(
            'Invalid or expired feedback link.'
          );
        }
      } catch (error) {
        console.error(
          'Error fetching batch:',
          error
        );
        setLoadError(
          'Unable to connect to the server. Please try again later.'
        );
      }
    };

    fetchBatchData();
  }, [batchId]);

  const handleRatingChange = (
    paramIndex,
    subjectCode,
    value
  ) => {
    setRatings((prev) => ({
      ...prev,
      [`${paramIndex}-${subjectCode}`]: value,
    }));
  };

  const handleFacultyComment = (code, value) => {
    setFacultyComments((prev) => ({
      ...prev,
      [code]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const totalFields =
      PARAMETERS.length *
      batchData.faculty.length;
    const filledFields = Object.values(
      ratings
    ).filter(
      (v) => v !== '' && v !== undefined
    ).length;

    if (filledFields < totalFields) {
      alert(
        '⚠️ Please rate all parameters for all subjects'
      );
      return;
    }

    setSubmitLoading(true);

    try {
      // Combine all comments:
      // faculty-specific + general/college
      const allComments = [];

      batchData.faculty.forEach((fac) => {
        const comment =
          facultyComments[fac.code]?.trim();
        if (comment) {
          allComments.push(
            `[FACULTY:${fac.code}:${fac.name}] ${comment}`
          );
        }
      });

      if (generalComments.trim()) {
        allComments.push(
          `[GENERAL] ${generalComments.trim()}`
        );
      }

      const combinedComments =
        allComments.join(' ||| ');

      const feedbackData = {
        batchId,
        comments: combinedComments,
        responses: [],
      };

      batchData.faculty.forEach((fac) => {
        const facultyRatings = {};
        PARAMETERS.forEach((param, idx) => {
          const rating =
            ratings[`${idx}-${fac.code}`];
          facultyRatings[param] =
            parseInt(rating);
        });

        feedbackData.responses.push({
          facultyId: fac.id,
          ratings: facultyRatings,
        });
      });

      await dataService.submitFeedback(
        feedbackData
      );
      setSubmitted(true);
      setShowModal(false);
    } catch (error) {
      console.error(
        'Feedback submission error:',
        error
      );
      alert(
        error.message ||
          'Failed to submit feedback.'
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loadError) {
    return (
      <div className="feedback-page">
        <div className="loading">
          <p>❌ {loadError}</p>
        </div>
        <DeveloperCredit />
      </div>
    );
  }

  if (!batchData) {
    return (
      <div className="feedback-page">
        <div className="loading">
          Loading feedback form...
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="feedback-page">
        <div className="success-container">
          <div className="success-card">
            <div className="success-icon">
              ✅
            </div>
            <h1>Thank You!</h1>
            <p>
              Your feedback has been submitted
              successfully.
            </p>
            <div className="batch-info">
              {batchData.dept} - Year{' '}
              {batchData.year} • Sem{' '}
              {batchData.sem} • Section{' '}
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
                <h1>
                  RISE Krishna Sai Prakasam
                  Group of Institutions
                </h1>
                <h2>
                  Valluru (V), Ongole (M),
                  Prakasam (Dt)
                </h2>
                <h3>
                  Feedback on Teaching and
                  Learning
                </h3>
                <p className="form-title">
                  (To be filled by students at
                  the end of the semester)
                </p>
              </div>
              <div className="meta-tags">
                <span>
                  📚 {batchData.dept}{' '}
                  Department
                </span>
                <span>
                  🎓 Year {batchData.year}
                </span>
                <span>
                  📖 Semester {batchData.sem}
                </span>
                <span>
                  🏫 Section {batchData.sec}
                </span>
              </div>
            </div>

            <div className="modal-body">
              <div className="faculty-mapping-table">
                <h3>
                  Subject - Faculty Mapping
                </h3>
                <table className="mapping-table">
                  <thead>
                    <tr>
                      <th className="code-cell">
                        Subject Code
                      </th>
                      <th className="name-cell">
                        Faculty Name
                      </th>
                      <th className="subject-cell">
                        Subject
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchData.faculty.map(
                      (fac) => (
                        <tr key={fac.code}>
                          <td className="code-cell">
                            {fac.code}
                          </td>
                          <td className="name-cell">
                            {fac.name}
                          </td>
                          <td className="subject-cell">
                            {fac.subject}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className="rating-info">
                <strong>Rating Scale:</strong>{' '}
                10 = Outstanding • 9 = Excellent
                • 8 = Very Good • 7 = Good • 6 =
                Above Average • 5 = Average • 4 =
                Fair • 3 = Below Average • 2 =
                Poor • 1 = Very Poor
              </div>

              <form onSubmit={handleSubmit}>
                <div className="feedback-table-wrapper">
                  <table className="feedback-table">
                    <thead>
                      <tr>
                        <th className="sno-col">
                          S.No
                        </th>
                        <th className="param-col">
                          Parameters
                        </th>
                        {batchData.faculty.map(
                          (fac) => (
                            <th
                              key={fac.code}
                              className="subject-col"
                            >
                              {fac.code}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {PARAMETERS.map(
                        (param, idx) => (
                          <tr key={idx}>
                            <td className="center-text">
                              {idx + 1}
                            </td>
                            <td className="param-text">
                              {param}
                            </td>
                            {batchData.faculty.map(
                              (fac) => (
                                <td
                                  key={
                                    fac.code
                                  }
                                  className="rating-cell"
                                >
                                  <select
                                    className="rating-select"
                                    value={
                                      ratings[
                                        `${idx}-${fac.code}`
                                      ] || ''
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      handleRatingChange(
                                        idx,
                                        fac.code,
                                        e.target
                                          .value
                                      )
                                    }
                                    required
                                  >
                                    <option value="">Rate</option>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                    <option value="5">5</option>
                                    <option value="6">6</option>
                                    <option value="7">7</option>
                                    <option value="8">8</option>
                                    <option value="9">9</option>
                                    <option value="10">10</option>
                                  </select>
                                </td>
                              )
                            )}
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Per-Faculty Comments */}
                <div
                  style={{
                    margin: '24px 0',
                    padding: '20px',
                    background:
                      'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
                    borderRadius: '14px',
                    border:
                      '2px solid #0ea5e9',
                  }}
                >
                  <h3
                    style={{
                      margin: '0 0 16px 0',
                      fontSize: '16px',
                      fontWeight: '800',
                      color: '#0c4a6e',
                    }}
                  >
                    💬 Comments on Each Faculty
                    (Optional)
                  </h3>
                  {batchData.faculty.map(
                    (fac) => (
                      <div
                        key={fac.code}
                        style={{
                          marginBottom: '14px',
                        }}
                      >
                        <label
                          style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: '700',
                            marginBottom:
                              '4px',
                            color: '#1e40af',
                          }}
                        >
                          {fac.code} —{' '}
                          {fac.name} (
                          {fac.subject})
                        </label>
                        <textarea
                          value={
                            facultyComments[
                              fac.code
                            ] || ''
                          }
                          onChange={(e) =>
                            handleFacultyComment(
                              fac.code,
                              e.target.value
                            )
                          }
                          placeholder={`Comments on ${fac.name}'s teaching...`}
                          style={{
                            width: '100%',
                            minHeight: '50px',
                            padding: '10px',
                            border:
                              '2px solid #cbd5e1',
                            borderRadius:
                              '10px',
                            fontSize: '13px',
                            resize:
                              'vertical',
                          }}
                        />
                      </div>
                    )
                  )}
                </div>

                {/* General / College Comments */}
                <div
                  style={{
                    margin: '0 0 24px 0',
                    padding: '20px',
                    background:
                      'linear-gradient(135deg, #fefce8, #fef9c3)',
                    borderRadius: '14px',
                    border:
                      '2px solid #eab308',
                  }}
                >
                  <h3
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: '16px',
                      fontWeight: '800',
                      color: '#854d0e',
                    }}
                  >
                    🏫 General Comments
                    (Optional)
                  </h3>
                  <p
                    style={{
                      margin: '0 0 12px 0',
                      fontSize: '12px',
                      color: '#a16207',
                    }}
                  >
                    Share feedback about
                    college environment,
                    facilities, labs,
                    library, canteen,
                    infrastructure, or any
                    other suggestions.
                  </p>
                  <textarea
                    value={generalComments}
                    onChange={(e) =>
                      setGeneralComments(
                        e.target.value
                      )
                    }
                    placeholder="E.g., The lab needs more computers, library should have extended hours, WiFi connectivity is poor..."
                    style={{
                      width: '100%',
                      minHeight: '70px',
                      padding: '10px',
                      border:
                        '2px solid #fbbf24',
                      borderRadius: '10px',
                      fontSize: '13px',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div className="modal-footer">
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={submitLoading}
                  >
                    {submitLoading
                      ? '⏳ Submitting...'
                      : '✅ Submit Feedback'}
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