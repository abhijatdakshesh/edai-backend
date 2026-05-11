import streamlit as st
import pandas as pd
import base64 
from pathlib import Path
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle,Paragraph,Image
import io
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
import textwrap
import zipfile
from io import BytesIO
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email.utils import COMMASPACE
from email import encoders

from datetime import date

def resolve_signature_image_path(branch_choice):
    """Return a valid signature image path for the given branch, with safe fallbacks.

    Uses an existing image as a default to avoid missing-file errors.
    """
    # Prefer a known-good fallback that exists in the repo
    fallback_path = "Images/CSE_Signature.png"
    branch_to_path = {
        "COMPUTER SCIENCE & ENGINEERING": "Images/CSE_Signature.png",
        "INFORMATION SCIENCE & ENGINEERING": "Images/ISE_sign.png",
        "ELECTRONICS & COMMUNICATION ENGINEERING": "Images/ECE_Signature.png",
        "MECHANICAL ENGINEERING": "Images/ME_Signature.png",
        "MASTER OF COMPUTER APPLICATIONS": "Images/MCA_Signature.png",
    }
    path = branch_to_path.get(branch_choice, fallback_path)
    try:
        # Validate file existence early; reportlab will throw later otherwise
        Path(path).resolve(strict=True)
        return path
    except Exception:
        return fallback_path

hide_st_style = """
            <style>
            #MainMenu {visibility: hidden;}
            footer {visibility: hidden;}
            header {visibility: hidden;}
            </style>
            """
st.markdown(hide_st_style, unsafe_allow_html=True)


def generate_pdf(df, row,Branch_Choice,test_choice,submission_d,semester,no_of_subjects,note):  

    from datetime import datetime
    today = datetime.today()
    day = today.day
    suffix = 'th' if 11 <= day <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(day % 10, 'th')
    date_of_generation = today.strftime(f"%d{suffix} %b, %Y")
    date_of_generation = str(date_of_generation)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0, leftMargin=50, rightMargin=50, bottomMargin=0)
    
    styles = getSampleStyleSheet()

    # Creating a bold and capitalized Times New Roman style
    bold_times_style = styles["Heading1"]
    bold_times_style.fontName = "Times-Bold"
    bold_times_style.fontSize = 12 
    bold_times_style.alignment = 1
    bold_times_style.textTransform = "uppercase"
    bold_times_style.spaceAfter = 1
    bold_times_style.spaceBefore = 1

    bold_style = styles["Heading2"]
    bold_style.fontName = "Times-Bold"
    bold_style.fontSize = 10
    bold_style.spaceAfter = 1
    bold_style.spaceBefore = 1

    elements = [] 

    header_path = "Images/Header_RV.png"
    image = Image(header_path, width=8*inch, height=1.6445*inch)
    image.vAlign = "TOP"
    elements.append(image)

    heading = Paragraph('<u>'+Branch_Choice+'</u>', bold_times_style)
    elements.append(heading)
 
    heading = Paragraph('<u>'+test_choice+'</u>', bold_times_style)
    elements.append(heading)

    style_sheet = getSampleStyleSheet() #date
    style = style_sheet['Normal']
    text = date_of_generation
    para = Paragraph(text, style)
    elements.append(para)

    style_sheet = getSampleStyleSheet() #date
    style = style_sheet['Normal']
    text = "\u00a0"
    para = Paragraph(text, style)
    elements.append(para)

    style_sheet = getSampleStyleSheet()
    style = style_sheet['Normal']
    text = "To, "
    para = Paragraph(text, style)
    elements.append(para)
    
    father = str(df.iloc[row, 2])  # Father Name is in column 2
    heading = Paragraph("\u00a0 \u00a0 \u00a0Mr/Mrs \u00a0"+father+",", bold_style)
    elements.append(heading)

    student_name = df.iloc[row,0]  # Student Name is in column 0
    USN = df.iloc[row,1]  # USN is in column 1
    style_sheet = getSampleStyleSheet()
    style = style_sheet['Normal']
    text = "\u00a0 \u00a0 \u00a0 \u00a0 \u00a0 \u00a0The Attendance report of your ward <b>"+str(student_name)+",\u00a0"+str(USN)+"</b> studying in <b>"+str(semester)+"</b> is given below : "
    para = Paragraph(text, style)
    elements.append(para)

    wrapped_sl = textwrap.fill("Sl. No", width=3)
    wrapped_attendance  = textwrap.fill("Attendance Percentage", width=10)
    wrapped_classheld  = textwrap.fill("Classes Held", width=7)
    wrapped_classattended = textwrap.fill("Classes Attended", width=9)
    # Handle potential NaN values in column headers - get from first subject's columns (7 and 8)
    # Column 7 is Test marks, Column 8 is Assignment for the first subject
    test_marks_header = df.iloc[0, 7] if 7 < df.shape[1] and not pd.isna(df.iloc[0, 7]) else "Test Marks"
    assignment_header = df.iloc[0, 8] if 8 < df.shape[1] and not pd.isna(df.iloc[0, 8]) else "Assignment"
    # Clean up the header text to remove "(Max Marks XX)" if present
    if isinstance(test_marks_header, str) and "(" in test_marks_header:
        test_marks_header = test_marks_header.split("(")[0].strip()
    if isinstance(assignment_header, str) and "(" in assignment_header:
        assignment_header = assignment_header.split("(")[0].strip()
    wrapped_testmarks = textwrap.fill(str(test_marks_header), width=10)
    wrapped_assignment = textwrap.fill(str(assignment_header), width=10)
    data = [[wrapped_sl,"Subject Name",wrapped_classheld,wrapped_classattended,wrapped_attendance,wrapped_testmarks,wrapped_assignment]]

    for i in range(no_of_subjects):
        # New structure: each subject has 5 columns (subject, test marks, assignment, classes held, classes attended)
        # Starting from column 6 (after Student Name, USN, Father Name, Parent Email, Counsellor Email, Remarks)
        subject_col = 6 + i * 5
        test_marks_col = 7 + i * 5
        assignment_col = 8 + i * 5
        classes_held_col = 9 + i * 5
        classes_attended_col = 10 + i * 5
        
        # Check if columns exist in the dataframe
        if subject_col >= df.shape[1]:
            break  # Skip if column doesn't exist
        
        # Get subject name from header row (row 0) for consistency, fallback to student row if needed
        # Handle cases where row 0 might contain category headers like "Professional Elective"
        # and the actual subject names are in row 1
        subject = None
        if subject_col < df.shape[1]:
            # First, check row 0
            row0_value = None
            if not pd.isna(df.iloc[0, subject_col]):
                row0_value = str(df.iloc[0, subject_col]).strip()
            
            # Check if row 0 contains a category header (like "Professional Elective")
            category_keywords = ["professional elective", "open elective", "elective", "core", "lab"]
            is_category_header = False
            if row0_value:
                row0_lower = row0_value.lower()
                # Check if it's a category header - typically short phrases with elective/core/lab keywords
                is_category_header = any(keyword in row0_lower for keyword in category_keywords) and len(row0_value.split()) <= 4
            
            # If row 0 is a category header, check row 1 for the actual subject name
            if is_category_header and df.shape[0] > 1:
                # Check row 1 for the actual subject name
                if not pd.isna(df.iloc[1, subject_col]):
                    row1_value = str(df.iloc[1, subject_col]).strip()
                    # Only use row 1 if it's not empty and not another category header
                    if row1_value and not any(keyword in row1_value.lower() for keyword in category_keywords):
                        subject = row1_value
                
                # If row 1 doesn't have a valid subject, try the student row
                if (subject is None or pd.isna(subject) or subject == "") and row >= 2 and not pd.isna(df.iloc[row, subject_col]):
                    student_row_value = str(df.iloc[row, subject_col]).strip()
                    if student_row_value and student_row_value != "":
                        subject = student_row_value
            elif row0_value and row0_value != "":
                # Use row 0 value if it's not a category header
                subject = row0_value
            elif row < df.shape[0] and not pd.isna(df.iloc[row, subject_col]):
                # Fallback to student row
                subject = df.iloc[row, subject_col]
        
        # Convert subject to string and handle NaN values
        if subject is None or pd.isna(subject) or str(subject).strip() == "":
            subject = f"Subject {i + 1}"
        else:
            subject = str(subject).strip()  # Strip whitespace for cleaner display
            
        try:
            if classes_attended_col < df.shape[1]:
                classattended_val = df.iloc[row, classes_attended_col]
                if pd.isna(classattended_val) or str(classattended_val).strip() == '-':
                    classattended = 0
                else:
                    classattended = int(classattended_val)
            else:
                classattended = 0
        except (ValueError, TypeError):
            classattended = 0
            
        try:
            if classes_held_col < df.shape[1]:
                classesheld_val = df.iloc[row, classes_held_col]
                if pd.isna(classesheld_val) or str(classesheld_val).strip() == '-':
                    classesheld = 0
                else:
                    classesheld = int(classesheld_val)
            else:
                classesheld = 0
        except (ValueError, TypeError):
            classesheld = 0
        
        # Get test marks
        try:
            if test_marks_col < df.shape[1]:
                test_marks_val = df.iloc[row, test_marks_col]
                if pd.isna(test_marks_val) or str(test_marks_val).strip() == '-':
                    test_marks = '-'
                else:
                    test_marks = str(int(float(test_marks_val)))  # Handle float values
            else:
                test_marks = '-'
        except (ValueError, TypeError):
            test_marks = '-'
            
        # Get assignment marks
        try:
            if assignment_col < df.shape[1]:
                assignment_val = df.iloc[row, assignment_col]
                if pd.isna(assignment_val) or str(assignment_val).strip() == '-':
                    assignment = '-'
                else:
                    assignment = str(int(float(assignment_val)))  # Handle float values
            else:
                assignment = '-'
        except (ValueError, TypeError):
            assignment = '-'
    
        # Check if both classesheld and classattended are zero
        if classesheld == 0 and classattended == 0:
            classesheld = '-'
            classattended = '-'
            attendance = '-'
        else:
            try:
                attendance = int(classattended / classesheld * 100)
                # Ensure attendance percentage never exceeds 100%
                if attendance > 100:
                    attendance = 100
            except ZeroDivisionError:
                attendance = 0
    
      
        wrapped_subject = textwrap.fill(subject, width=30)
        
        # Format attendance percentage
        if attendance == '-':
            attendance_str = '-'
        else:
            attendance_str = "{}%".format(attendance)
    
        data.append([str(i + 1), wrapped_subject, classesheld, classattended, attendance_str, test_marks, assignment])

    table = Table(data, splitByRow=1, spaceBefore=10, spaceAfter=10, cornerRadii=[1.5,1.5,1.5,1.5])
    

    table.setStyle(TableStyle([      
    
    ('BACKGROUND', (0, 0), (-1, 0), '#FFFFFF'),
    ('TEXTCOLOR', (0, 0), (-1, 0), '#000000'),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('fontsize', (-1,-1), (-1,-1), 12),
    ('ALIGNMENT', (1, 1), (1, -1), 'LEFT'),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
    ('BACKGROUND', (0, 1), (-1, -1), '#FFFFFF'),
    ('GRID', (0, 0), (-1, -1), 1, "black")
  ]))

    elements.append(table)

    style_sheet = getSampleStyleSheet()
    style = style_sheet['Normal']
    # Handle NaN values in remarks - show empty string if NaN
    remarks_value = df.iloc[row, 5]
    if pd.isna(remarks_value) or str(remarks_value).strip() == '' or str(remarks_value).lower() == 'nan':
        remarks_text = ""
    else:
        remarks_text = str(remarks_value)
    text = "<b>Remarks:</b>\u00a0"+remarks_text+""
    para = Paragraph(text, style)
    elements.append(para)

    style = style_sheet['Normal']
    text = "\u00a0 "
    para = Paragraph(text, style)
    elements.append(para)

    style_sheet = getSampleStyleSheet()
    style = style_sheet['Normal']
    text = "<b>Note:</b>\u00a0"+str(note)+""
    para = Paragraph(text, style)
    elements.append(para)


    style = style_sheet['Normal']
    text = "\u00a0 "
    para = Paragraph(text, style)
    elements.append(para)


    counsellor_mail = str(df.iloc[row,4])  # Counsellor Email is in column 4
    style_sheet = getSampleStyleSheet()
    style = style_sheet['Normal']
    text = "Please sign and send the report to \""+counsellor_mail+"\" on or before "+submission_d+"."
    para = Paragraph(text, style)
    elements.append(para)

    image_path = resolve_signature_image_path(Branch_Choice)
    try:
        image = Image(image_path, width=7*inch, height=1.4155*inch)
    except Exception:
        # Final fallback to a known-good signature if the chosen one can't be read
        image = Image("Images/CSE_Signature.png", width=7*inch, height=1.4155*inch)
    elements.append(image)

    style_sheet = getSampleStyleSheet()
    style = style_sheet['Normal']
    text = "\u00a0" 
    para = Paragraph(text, style)
    elements.append(para)

    style_sheet = getSampleStyleSheet()
    style = style_sheet['Normal']
    text = "\u00a0"
    para = Paragraph(text, style)
    elements.append(para)

    style_sheet = getSampleStyleSheet()
    style = style_sheet['Normal']
    text = "This report was auto-generated through EDUSTACK RVITM"
    para = Paragraph(text, style)
    elements.append(para)

    doc.build(elements)
    
    buffer.seek(0)
    return buffer

def progress_pdf():
    # Initialize session state
    if 'branch_choice' not in st.session_state:
        st.session_state.branch_choice = "COMPUTER SCIENCE & ENGINEERING"
    if 'test_choice' not in st.session_state:
        st.session_state.test_choice = "CIE-1"
    if 'semester' not in st.session_state:
        st.session_state.semester = " I Semester BE  "
    if 'no_of_subjects' not in st.session_state:
        st.session_state.no_of_subjects = 1

    st.markdown("<div style='text-align:center;'><h2> </h2></div>", unsafe_allow_html=True,)

    st.markdown("<div style='text-align:center;'><h3> 📈 ATTENDANCE REPORT GENERATOR </h3></div>", unsafe_allow_html=True,)
    st.markdown("<div style='text-align:center;'><h1> </h1></div>", unsafe_allow_html=True,)

    Branch_Choice = st.selectbox("Choose Branch: ",["COMPUTER SCIENCE & ENGINEERING","INFORMATION SCIENCE & ENGINEERING","ELECTRONICS & COMMUNICATION ENGINEERING", "MECHANICAL ENGINEERING","MASTER OF COMPUTER APPLICATIONS"], key="branch_selectbox")

    test_choice = st.selectbox("Choose the test: ",["CIE-1", "CIE-2", "CIE-3"], key="test_selectbox")   

    submission_d = st.date_input("The Ward Should Submit the Signed Attendance Report to Counsellor Before:", date.today(), key="submission_date")
    day = submission_d.day
    suffix = 'th' if 11 <= day <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(day % 10, 'th')
    submission_d = submission_d.strftime(f"%d{suffix} %b, %Y")
    
    semester = st.selectbox("Select the Semester: ",[" I Semester BE  "," II Semester BE  ", " III Semester BE  "," IV Semester BE ", "V Semester BE", "VI Semester BE","VII Semester BE"," VIII Semester BE", "I Semester MCA", "II Semester MCA", "III Semester MCA", "IV Semester MCA","V Semester MCA","VI Semester MCA"], key="semester_selectbox")   
    
    uploaded_file = st.file_uploader("Upload the Marks Sheet Excel File for the test:", type=["xlsx"], key="file_uploader")
    
    # Auto-detect number of subjects from uploaded file
    detected_subjects = None
    if uploaded_file is not None:
        try:
            # Reset file pointer to beginning
            uploaded_file.seek(0)
            df_temp = pd.read_excel(uploaded_file)
            # Calculate number of subjects: (total columns - 6 basic columns) / 5 columns per subject
            detected_subjects = max(1, (df_temp.shape[1] - 6) // 5)
            if detected_subjects > 11:
                detected_subjects = 11
            # Reset file pointer again for later use
            uploaded_file.seek(0)
            st.info(f"📚 Detected {detected_subjects} subject(s) in the uploaded file. Please verify and adjust if needed.")
        except Exception as e:
            detected_subjects = None
            st.warning(f"Could not auto-detect number of subjects: {str(e)}")
    
    # Use detected subjects as default if available, otherwise use session state
    if detected_subjects is not None:
        default_subjects = detected_subjects
    else:
        default_subjects = st.session_state.get('no_of_subjects', 1)
    
    no_of_subjects = st.selectbox("Select the no of Subjects: ",[1,2,3,4,5,6,7,8,9,10,11], index=min(default_subjects-1, 10) if default_subjects >= 1 else 0, key="subjects_selectbox")   
    note = st.text_area("General Note (If any*):",placeholder="example: Attendace considered up till 17th March 2023")   

    
    if uploaded_file is not None:
      tab1,tab2, tab3 = st.tabs(["Generate & Download Report", 'Preview Report' ,"Confirm & Send Email"])
      with tab1:
        df = pd.read_excel(uploaded_file)

        progress_bar = st.progress(0, text = 'Generating Report')
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, "w") as zip_file:
            for i in range(2, df.shape[0]):
                buffer = generate_pdf(df, i, Branch_Choice, test_choice, submission_d, semester, no_of_subjects, note)
                file_name = f"{df.iloc[i, 1]}.pdf"
                zip_file.writestr(file_name, buffer.getvalue())
        
                progress_value = int((i - 1) / (df.shape[0] - 2) * 100)
                progress_bar.progress(progress_value, text = 'Generating Report')
        
        # Generate a download link for the zip file
        zip_name = ""+test_choice+"."+semester+".zip"
        b64 = base64.b64encode(zip_buffer.getvalue()).decode()
        download_link = f'<a href="data:application/zip;base64,{b64}" download="{zip_name}">click here to begin download</a>'
        st.markdown(download_link, unsafe_allow_html=True)


      with tab2:
      
        df = pd.read_excel(uploaded_file)
        st.write("Generating Preview of Attendance Report...")
        
        # Show a progress bar while the PDFs are being generated
        progress_bar = st.progress(0)
        
        # Generate the PDFs for each student and store it in a dictionary with the student name as the key
        pdfs = {}
        for i in range(2, df.shape[0]):
            buffer = generate_pdf(df, i, Branch_Choice, test_choice, submission_d,semester,no_of_subjects,note)
            file_name = f"{df.iloc[i, 1]}.pdf"
         
            b64 = base64.b64encode(buffer.getvalue()).decode()
            pdfs[file_name] = b64
            
            progress_value = int((i - 1) / (df.shape[0] - 2) * 100)
            progress_bar.progress(progress_value)
        
        # Show a selectbox to select the PDF to preview
        selected_pdf = st.selectbox("Select a student", list(pdfs.keys()))
        if selected_pdf is not None:
            b64 = pdfs[selected_pdf]
            st.write("""
            <iframe
                src="data:application/pdf;base64,{b64}"
                style="border: none; width: 100%; height: 970px;"
            ></iframe>
            """.format(b64=b64), unsafe_allow_html=True)

      with tab3:

       df = pd.read_excel(uploaded_file)
       SMTP_SERVER = "smtp.gmail.com"
       SMTP_PORT = 587
       with st.form("login_form"):
         st.write("Enter the mail ID login from which you want to send the mail:")
         
         SMTP_USERNAME = st.text_input('Input mail ID',help="Credentials are safe and not stored anywhere")
         SMTP_PASSWORD = st.text_input('Input password',type='password',help="For Gmail: Use an App Password (not your regular password). Generate one at: https://myaccount.google.com/apppasswords")
         st.info("ℹ️ **Gmail Users:** You must use an App Password, not your regular Gmail password. Enable 2-Step Verification and generate an App Password from your Google Account settings.")
         st.checkbox("I confirm that the Report generated are correct")
         submitted = st.form_submit_button("Confirm & send email")

       if submitted:
        if not SMTP_USERNAME or not SMTP_PASSWORD:
            st.error("Please enter both email and password")
        else:
            st.write("Sending Email...")
            total_emails = df.shape[0] - 2
            email_sent = 0
            failed_count = 0
            progress_bar = st.progress(0)
            
            # Create a single SMTP connection for all emails
            smtpObj = None
            try:
                smtpObj = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
                smtpObj.ehlo()
                smtpObj.starttls()
                smtpObj.login(SMTP_USERNAME, SMTP_PASSWORD)
                st.success("✅ Successfully connected to email server")
            except smtplib.SMTPAuthenticationError as e:
                st.error(f"❌ Authentication failed! Please check your credentials.")
                st.error("**For Gmail users:** Make sure you're using an App Password, not your regular password.")
                st.error("**Steps to create App Password:**")
                st.error("1. Enable 2-Step Verification on your Google Account")
                st.error("2. Go to https://myaccount.google.com/apppasswords")
                st.error("3. Generate an App Password for 'Mail'")
                st.error("4. Use that 16-character password here")
                st.stop()
            except Exception as e:
                st.error(f"❌ Failed to connect to email server: {str(e)}")
                st.stop()

            for i in range(2, df.shape[0]):
                buffer = generate_pdf(df, i, Branch_Choice, test_choice, submission_d,semester,no_of_subjects,note)
                file_name = f"{df.iloc[i, 1]}.pdf"
                
                # Get parent email address (column 3) and handle NaN/None values
                email_val = df.iloc[i, 3]  # Column 3: Parent Email
                if pd.isna(email_val) or str(email_val).strip() == '':
                    st.warning(f"Skipping {df.iloc[i, 1]} - No parent email address found")
                    failed_count += 1
                    continue
                email = str(email_val).strip()
                
                # Handle CC email - use counsellor/mentor email (column 4)
                cc_email_val = None
                if df.shape[1] > 4:
                    cc_email_val = df.iloc[i, 4]  # Column 4: Counsellor/Mentor Email
                cc_email = None
                if cc_email_val is not None and not pd.isna(cc_email_val) and str(cc_email_val).strip() != '':
                    cc_email = str(cc_email_val).strip()
                
                father = str(df.iloc[i, 2])  # Column 2: Father Name (consistent with PDF generation)
                student_name = str(df.iloc[i, 0])  # Column 0: Student Name

                msg = MIMEMultipart()
                msg['From'] = SMTP_USERNAME
                msg['To'] = email
                if cc_email:
                    msg['Cc'] = cc_email
                msg['Subject'] = ""+test_choice+"\u00a0 "+semester
                
                body = "Dear <b>"+father+"</b> ,<br><br>Herewith enclosed the <b>"+semester+" "+test_choice+"</b>\u00a0  of your ward <b>"+student_name+"</b><br><br>Thanks & Regards,<br><b>RVITM</b>"
                text = MIMEText(body,'html')
                msg.attach(text)
            
                # Attach the generated PDF
                part = MIMEBase('application', "octet-stream")
                part.set_payload((buffer.getvalue()))
                encoders.encode_base64(part)
                part.add_header('Content-Disposition', 'attachment', filename=file_name)
                msg.attach(part)
            
                # Send the email using the existing connection
                try:
                    # Prepare recipient list
                    recipients = [email]
                    if cc_email:
                        recipients.append(cc_email)
                    
                    smtpObj.sendmail(SMTP_USERNAME, recipients, msg.as_string())
                    st.write("✅ Email sent to\u00a0"+student_name+"\u00a0 parent's mail - ", email)
                    email_sent += 1
                except Exception as e:
                    st.error(f"❌ Failed to send email to {student_name} ({email}): {str(e)}")
                    failed_count += 1
                
                progress_bar.progress((i - 1) / (df.shape[0] - 2))
            
            # Close the SMTP connection
            if smtpObj:
                try:
                    smtpObj.quit()
                except:
                    pass
            
            # Show final summary
            if email_sent > 0:
                st.success(f"✅ Successfully sent {email_sent} email(s)")
            if failed_count > 0:
                st.warning(f"⚠️ Failed to send {failed_count} email(s)")
            if email_sent == total_emails:
                st.success("🎉 All Attendance Reports sent successfully!")


progress_pdf()