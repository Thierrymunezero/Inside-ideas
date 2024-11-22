-- PostgreSQL database dump

-- Dumped from database version 15.4
-- Dumped by pg_dump version 15.4

-- Started on 2024-11-22 18:20:18

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Table: public.book_notes

COPY public.book_notes (
    id, image_path, read_date, title, book_rating, takeaways, content, created_at, updated_at
) FROM stdin;
15	/uploads/982096ab8f0a316506ac6fa1db7fd2c1	2024-02-06	The 48 laws of power	10	The 48 Laws of Power by Robert Greene offers a guide to understanding and navigating power dynamics, focusing on the importance of strategy, manipulation, and psychological insight. The book emphasizes that power is neutral and can be used for various purposes, with human behavior being largely predictable. Greene stresses the importance of controlling one's emotions and adapting strategies based on circumstances. Laws like Never outshine the master (Law 1) and Conceal your intentions (Law 3) teach the value of subtlety, humility, and strategic planning in maintaining influence, while Court attention at all costs (Law 6) highlights the necessity of visibility for power. Additionally, the law Crush your enemy completely (Law 15) reveals the need for decisive action when confronted with opposition.	The book also delves into more psychological aspects of power, such as using others' self-interest to your advantage (When asking for help, appeal to self-interest - Law 13), and understanding personal vulnerabilities (Discover each man’s thumbscrew - Law 33). Greene advises leveraging these insights to gain control and influence over others. Some of the laws, like Use the surrender tactic (Law 22), suggest that knowing when to retreat and regroup can be more powerful than direct confrontation. However, while these laws are useful for navigating complex social and professional environments, they can also be seen as manipulative, urging readers to be mindful of their ethical implications when applying them.	2024-11-16 15:30:26.629913	2024-11-16 15:30:26.629913
13	/uploads/cbaf4d4bf1e300c49558de49195a7ae0	2024-03-05	The art of war	10	The Art of War is a book of conflict knowledge and tactics revolving around several key concepts, including: Knowing when to fight and when not to fight. Knowing how to mislead the enemy. Knowing oneself and one's enemy.	The Art of War by Sun Tzu provides valuable lessons on strategy and preparation. Key lessons include the importance of knowing both yourself and your enemy, choosing your battles wisely, understanding the significance of timing, and being adaptable in your strategies. It emphasizes readiness over reliance on the enemy's actions and the use of surprise to gain advantage.	2024-11-16 09:34:16.458373	2024-11-16 09:34:16.458373
7	/uploads/23259a9e3892eeb267ec2bcddfda82f6	2023-10-03	The pschology of money	10	Overall, The Psychology of Money is an insightful and thought-provoking book that offers a fresh perspective on a subject that affects us all. Whether you're struggling to manage your finances or simply looking for a better understanding of how money works, this book is definitely worth reading.	The Psychology of Money by Morgan Housel explores the complex relationship people have with money through 19 engaging stories. The book emphasizes that financial success is less about intelligence and more about behavior and mindset. It aims to help readers understand their own financial behaviors and make better financial decisions.	2024-11-14 01:05:15.416988	2024-11-14 01:05:15.416988
\.

-- Set sequence value for book_notes_id_seq
SELECT pg_catalog.setval('public.book_notes_id_seq', 15, true);

-- Table: public.user_admin

COPY public.user_admin (id, user_name, user_password) FROM stdin;
1	thierry	02
\.

-- Set sequence value for user_admin_id_seq
SELECT pg_catalog.setval('public.user_admin_id_seq', 1, true);

-- PostgreSQL database dump complete
