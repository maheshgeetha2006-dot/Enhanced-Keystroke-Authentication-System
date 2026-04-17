# Enhanced Keystroke Dynamics Authentication System

## Overview

This project implements an advanced user authentication system using keystroke dynamics, a behavioral biometric technique that identifies users based on their typing patterns.

Unlike traditional password-based authentication, this system enhances security by analyzing how a user types rather than just what they type.

The system is implemented as a web application using Flask and includes an improved matching algorithm and user-friendly interface.

---

## Key Features

* Keystroke-based authentication
* Euclidean Distance algorithm for pattern matching
* Match percentage display
* Retry mechanism (maximum 3 attempts)
* Typing consistency analysis using multiple samples
* Modern user interface with typing feedback

---

## Concept: Keystroke Dynamics

Every user has a unique typing rhythm. This system captures:

* Dwell Time – Time a key is pressed
* Flight Time – Time between consecutive keys

These features form a typing signature for each user.

---

## Algorithm Used

The system uses the Euclidean Distance algorithm to compare typing patterns.

Formula:

d = sqrt(sum (xi - yi)^2)

Where:

* xi = stored typing pattern
* yi = current typing pattern

Decision:

* If distance is less than threshold, user is accepted
* Otherwise, user is rejected

---

## System Architecture

User → Frontend UI → Keystroke Capture → Backend (Flask)
→ Feature Extraction → Euclidean Distance Algorithm
→ Database → Decision → Result

---

## Workflow

Registration:

* User enters password multiple times (5 samples)
* System calculates average typing pattern
* Data is stored

Login:

* User enters password
* Typing pattern is captured
* Compared with stored pattern
* Match percentage is calculated
* Access is granted or denied

---

## Technologies Used

* Frontend: HTML, CSS, JavaScript
* Backend: Python (Flask)
* Database: JSON or SQLite
* Algorithm: Euclidean Distance

---

## Results

* Genuine users are authenticated successfully
* Imposters are detected effectively
* Match percentage provides clear feedback

---

## Advantages

* No additional hardware required
* More secure than traditional passwords
* Easy to implement
* User-friendly system

---

## Limitations

* Typing behavior may vary
* Requires initial training data
* Slight delay during login

---

## Future Enhancements

* Integration with machine learning models
* Continuous authentication
* Multi-factor authentication
* Mobile support

---

## Conclusion

This project enhances authentication by combining password security with keystroke dynamics. By implementing the Euclidean Distance algorithm and adding features such as match percentage and retry mechanism, the system improves both accuracy and usability.

---

