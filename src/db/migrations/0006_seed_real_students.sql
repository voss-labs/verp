-- ============================================
-- 0006_seed_real_students.sql
-- Replace test students with real TE students
-- Div A: 88 students, Div B: 66 students (154 total)
-- From attendance sheets 2025-26 (Even semester)
-- ============================================

-- 1. Clear old test data
DELETE FROM student_enrollments WHERE student_id IN (
  SELECT id FROM students WHERE department = 'EXCS' AND division IN ('A', 'B') AND year = 'TE'
);
DELETE FROM marks WHERE student_id IN (
  SELECT id FROM students WHERE department = 'EXCS' AND division IN ('A', 'B') AND year = 'TE'
);
DELETE FROM students WHERE department = 'EXCS' AND division IN ('A', 'B') AND year = 'TE';

-- =====================
-- 2a. DIV A (88 students)
-- =====================
INSERT INTO students (id, first_name, last_name, roll_number, email, department, division, year, semester)
VALUES
  -- Batch 1 (1-17)
  (gen_random_uuid(), 'Niraj', 'Pashte', '23108A0002', 'niraj.pashte@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Aditya', 'Pradhan', '23108A0010', 'aditya.pradhan@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Advesh', 'Tambat', '23108A0013', 'advesh.tambat@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Manvith', 'Shetty', '23108A0019', 'manvith.shetty@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Maneeth', 'Reddy', '23108A0025', 'maneeth.reddy@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Anurag', 'Ubarhande', '23108A0043', 'anurag.ubarhande@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Utkarsh', 'Khatal', '23108A0059', 'utkarsh.khatal@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Atul', 'Kumar', '23108A0064', 'atul.kumar@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Vedant', 'Mahalle', '23108A0072', 'vedant.mahalle@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Aryan', 'Tate', '23108A0047', 'aryan.tate@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Subhansu', 'Bind', '23108A0048', 'subhansu.bind@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Jiya', 'Jadhav', '23108A0014', 'jiya.jadhav@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Gargi', 'Kusnoor', '23108A0035', 'gargi.kusnoor@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Om', 'Kolhe', '23108A0062', 'om.kolhe@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Raj', 'Mali', '23108A0063', 'raj.mali@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Nachammai', 'Chettiar', '23108A0070', 'nachammai.chettiar@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Sahil', 'Pandhare', '24108A2002', 'sahil.pandhare@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  -- Batch 2 (18-40)
  (gen_random_uuid(), 'Shubhan', 'Telang', '23108A0003', 'shubhan.telang@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Swarali', 'Gandhi', '23108A0005', 'swarali.gandhi@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Aranya', 'Sinha', '23108A0006', 'aranya.sinha@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Christina Esther', 'Nadar', '23108A0009', 'christina.nadar@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Arnav', 'Kadam', '23108A0012', 'arnav.kadam@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Lubdha', 'Modak', '23108A0015', 'lubdha.modak@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Suhani', 'Khanna', '23108A0016', 'suhani.khanna@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Om', 'Mohite', '23108A0018', 'om.mohite@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Manas', 'Deshpande', '23108A0021', 'manas.deshpande@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Mandar', 'Patil', '23108A0023', 'mandar.patil@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Atharva', 'Gosavi', '23108A0024', 'atharva.gosavi@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Tanvi', 'Bhoye', '23108A0026', 'tanvi.bhoye@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Taniya', 'Renjarla', '23108A0027', 'taniya.renjarla@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Vedika', 'Karande', '23108A0028', 'vedika.karande@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Parth', 'Boke', '23108A0029', 'parth.boke@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Paras', 'Kumbhare', '23108A0030', 'paras.kumbhare@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Hemant', 'Bhoi', '23108A0032', 'hemant.bhoi@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Aditya', 'Deshmukh', '23108A0033', 'aditya.deshmukh@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Jyoti', 'Chitalkar', '23108A0036', 'jyoti.chitalkar@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Ayush', 'Jare', '23108A0037', 'ayush.jare@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Nandini', 'Yedelli', '23108A0038', 'nandini.yedelli@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Karam', 'Sayed', '23108A0039', 'karam.sayed@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Yash', 'Pawar', '23108A0040', 'yash.pawar@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  -- Batch 3 (41-64)
  (gen_random_uuid(), 'Ashish', 'Prajapati', '23108A0041', 'ashish.prajapati@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Anand', 'Rathod', '23108A0042', 'anand.rathod@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Mohd Anas', 'Choudhari', '23108A0044', 'mohdanas.choudhari@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Vaishnavi', 'Patil', '23108A0045', 'vaishnavi.patil@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Vaishnavi', 'Muley', '23108A0046', 'vaishnavi.muley@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Mayuresh', 'Takalkar', '23108A0049', 'mayuresh.takalkar@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Harsh', 'Latane', '23108A0050', 'harsh.latane@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Rudra', 'Sharma', '23108A0051', 'rudra.sharma@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Lokesh', 'Pawar', '23108A0052', 'lokesh.pawar@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Akshita', 'Joshi', '23108A0053', 'akshita.joshi@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Harshal', 'More', '23108A0054', 'harshal.more@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Siddhi', 'Ayare', '23108A0055', 'siddhi.ayare@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Utkarsh', 'Singh', '23108A0056', 'utkarsh.singh@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Samiksha', 'Chavan', '23108A0057', 'samiksha.chavan@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Sanika', 'Sonavane', '23108A0058', 'sanika.sonavane@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Kanchan', 'Chavan', '23108A0060', 'kanchan.chavan@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Aniket', 'Saw', '23108A0061', 'aniket.saw@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Ayush', 'Dhabsa', '23108A0065', 'ayush.dhabsa@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Jagruti', 'Thotam', '23108A0066', 'jagruti.thotam@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Himanshu', 'Shinde', '23108A0068', 'himanshu.shinde@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Omkar', 'Shinde', '23108A0069', 'omkar.shinde@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Shubham', 'Ralkar', '23108A0073', 'shubham.ralkar@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Jayraj', 'Sawant', '23108A0075', 'jayraj.sawant@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Niditi', 'Pandire', '23108A0076', 'niditi.pandire@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  -- Batch 4 (65-88)
  (gen_random_uuid(), 'Anushka', 'Pimpalshende', '23108A0077', 'anushka.pimpalshende@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Amritpal Singh', 'Banga', '23108A0078', 'amritpal.banga@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Aradhya', 'Bangal', '23108A0079', 'aradhya.bangal@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Vighnesh', 'Sontakke', '23108A0080', 'vighnesh.sontakke@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Vedant', 'Shelke', '23108A0081', 'vedant.shelke@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Snehal', 'Gaikwad', '24108A2001', 'snehal.gaikwad@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Aboli', 'Shinde', '24108A2003', 'aboli.shinde@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Rutuja', 'Palve', '24108A2004', 'rutuja.palve@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Faizan Mustaffa', 'Shaikh', '24108A2005', 'faizan.shaikh@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Aarya', 'Desai', '24108A2006', 'aarya.desai@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Raju', 'Khade', '24108A2007', 'raju.khade@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Ayaan', 'Shaikh', '24108A2008', 'ayaan.shaikh@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Suraj', 'Kadam', '24108A2009', 'suraj.kadam@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Atharva', 'Joshi', '24108A2010', 'atharva.joshi@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Aryan', 'Dikshit', '24108A2011', 'aryan.dikshit@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Bhagyesh', 'Chaudhari', '24108A2012', 'bhagyesh.chaudhari@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Anushka', 'Jaras', '24108A2013', 'anushka.jaras@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Mohammadbilal', 'Rashidee', '24108A2014', 'mohammadbilal.rashidee@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Prem', 'Thoke', '24108A2015', 'prem.thoke@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Arin', 'Govekar', '24108A2016', 'arin.govekar@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Chirag', 'Parekh', '24108A2017', 'chirag.parekh@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Shamail', 'Pawar', '24108A2018', 'shamail.pawar@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Nikhil', 'Patil', '24108A2019', 'nikhil.patil@vit.edu.in', 'EXCS', 'A', 'TE', '6'),
  (gen_random_uuid(), 'Manav', 'Mishra', '22108A0034', 'manav.mishra@vit.edu.in', 'EXCS', 'A', 'TE', '6')
ON CONFLICT (roll_number) DO NOTHING;

-- =====================
-- 2b. DIV B (66 students)
-- =====================
INSERT INTO students (id, first_name, last_name, roll_number, email, department, division, year, semester)
VALUES
  -- Batch 1 (1-13)
  (gen_random_uuid(), 'Sharvari', 'Navare', '23108B0004', 'sharvari.navare@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Tanmay', 'Gokhale', '23108B0010', 'tanmay.gokhale@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Harsh', 'Thakur', '23108B0023', 'harsh.thakur@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Shriya', 'Ise', '23108B0026', 'shriya.ise@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Pratik', 'Bhoir', '23108B0032', 'pratik.bhoir@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Abhiroop', 'Kale', '23108B0033', 'abhiroop.kale@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Tania', 'Vithayathil', '23108B0036', 'tania.vithayathil@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Aayush', 'Deshmukh', '23108B0068', 'aayush.deshmukh@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Kshitij', 'Patil', '23108B0073', 'kshitij.patil@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Nikunj', 'Pandey', '23108B0055', 'nikunj.pandey@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Shrut', 'Patil', '23108B0042', 'shrut.patil@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Manohar', 'Dhangar', '23108B0043', 'manohar.dhangar@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Sandesh', 'Jadhav', '23108B0081', 'sandesh.jadhav@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  -- Batch 2 (14-30)
  (gen_random_uuid(), 'Swayam', 'Navle', '23108B0001', 'swayam.navle@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Maitry', 'Mohite', '23108B0002', 'maitry.mohite@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Gopal', 'Prusty', '23108B0003', 'gopal.prusty@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Mohd Hamza', 'Arshad', '23108B0005', 'mohdhamza.arshad@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Vivek', 'Jha', '23108B0006', 'vivek.jha@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Vishwajeet', 'Patil', '23108B0007', 'vishwajeet.patil@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Yash', 'Thakre', '23108B0008', 'yash.thakre@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Pranav', 'Naik', '23108B0009', 'pranav.naik@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Jhalak', 'Dawani', '23108B0011', 'jhalak.dawani@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Gaurav', 'Somwanshi', '23108B0012', 'gaurav.somwanshi@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Shubham', 'Penkar', '23108B0013', 'shubham.penkar@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Tushar', 'Attarde', '23108B0015', 'tushar.attarde@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Devanshu', 'Bachhav', '23108B0016', 'devanshu.bachhav@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Kiah', 'Vaidya', '23108B0017', 'kiah.vaidya@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Suchit', 'Sartandel', '23108B0018', 'suchit.sartandel@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Meet', 'Nachanekar', '23108B0019', 'meet.nachanekar@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Arjun', 'Kawale', '23108B0020', 'arjun.kawale@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  -- Batch 3 (31-48)
  (gen_random_uuid(), 'Kartikean', 'Budarap', '23108B0021', 'kartikean.budarap@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Shreya', 'Vekhande', '23108B0022', 'shreya.vekhande@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Zaid', 'Shaikh', '23108B0025', 'zaid.shaikh@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Chandana', 'Vanage', '23108B0027', 'chandana.vanage@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Rashi', 'Manjrekar', '23108B0028', 'rashi.manjrekar@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Kabir', 'Swani', '23108B0031', 'kabir.swani@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Trupti', 'Vibhute', '23108B0035', 'trupti.vibhute@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Arnav', 'Sonavane', '23108B0039', 'arnav.sonavane@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Harsh', 'Sawsakde', '23108B0044', 'harsh.sawsakde@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Devdatta', 'Talele', '23108B0045', 'devdatta.talele@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Sarthak', 'Zagade', '23108B0047', 'sarthak.zagade@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Sejal', 'Andhale', '23108B0049', 'sejal.andhale@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Siddhi', 'Lad', '23108B0050', 'siddhi.lad@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Abhishek', 'Aman', '23108B0053', 'abhishek.aman@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Affan', 'Ansari', '23108B0054', 'affan.ansari@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Amey', 'Pawar', '23108B0057', 'amey.pawar@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Rishikesh', 'Patil', '23108B0059', 'rishikesh.patil@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Tanvi', 'Yerram', '23108B0062', 'tanvi.yerram@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  -- Batch 4 (49-66)
  (gen_random_uuid(), 'Shriya', 'Patkar', '23108B0063', 'shriya.patkar@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Akshata', 'Nalawade', '23108B0064', 'akshata.nalawade@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Yadnyesh', 'Chiplunkar', '23108B0065', 'yadnyesh.chiplunkar@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Manas', 'Pote', '23108B0066', 'manas.pote@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Sahil', 'Patil', '23108B0069', 'sahil.patil@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Shraddha', 'Patil', '23108B0070', 'shraddha.patil@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Nidhi', 'Chougule', '23108B0071', 'nidhi.chougule@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Om', 'Bhagwat', '23108B0072', 'om.bhagwat@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Samyak', 'Sakhare', '23108B0074', 'samyak.sakhare@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Alisha', 'Sawant', '23108B0075', 'alisha.sawant@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Arnav', 'Tripathi', '23108B0076', 'arnav.tripathi@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Aditya', 'Tambe', '23108B0077', 'aditya.tambe@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Archit', 'Uke', '23108B0078', 'archit.uke@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Vrushan', 'Patil', '23108B0079', 'vrushan.patil@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Dhanush', 'Chowke', '23108B0080', 'dhanush.chowke@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Vivek', 'Jaiswal', '23108B0082', 'vivek.jaiswal@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Siddhesh', 'Patil', '23108B0083', 'siddhesh.patil@vit.edu.in', 'EXCS', 'B', 'TE', '6'),
  (gen_random_uuid(), 'Jainam', 'Jain', '23108B0084', 'jainam.jain@vit.edu.in', 'EXCS', 'B', 'TE', '6')
ON CONFLICT (roll_number) DO NOTHING;

-- =====================
-- 3. Enroll all students in their division's offerings
-- =====================
DO $$
DECLARE
  sem_id integer;
  s_id uuid;
  s_div text;
BEGIN
  SELECT id INTO sem_id FROM semesters WHERE is_current = true LIMIT 1;

  FOR s_id, s_div IN SELECT id, division FROM students WHERE department = 'EXCS' AND year = 'TE' AND is_active = true
  LOOP
    -- Core offerings (matching division)
    INSERT INTO student_enrollments (course_offering_id, student_id)
    SELECT co.id, s_id FROM course_offerings co
    JOIN courses c ON co.course_id = c.id
    WHERE co.semester_id = sem_id
      AND co.division = s_div
      AND c.course_code IN ('PCEC12T', 'PCEC13T', 'PCEC14T', 'PCEC13P', 'PCEC14P', 'PRJ02')
    ON CONFLICT (course_offering_id, student_id) DO NOTHING;

    -- Electives (no division)
    INSERT INTO student_enrollments (course_offering_id, student_id)
    SELECT co.id, s_id FROM course_offerings co
    JOIN courses c ON co.course_id = c.id
    WHERE co.semester_id = sem_id
      AND co.division IS NULL
      AND c.course_code IN ('PEEC05T', 'PEEC05P', 'PEEC09T', 'PEEC09P', 'MDMIE02')
    ON CONFLICT (course_offering_id, student_id) DO NOTHING;
  END LOOP;
END;
$$;
