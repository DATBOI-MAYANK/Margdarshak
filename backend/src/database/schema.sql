-- Create Database
CREATE DATABASE IF NOT EXISTS travel_itinerary_db;
USE travel_itinerary_db;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('Traveler', 'Admin') DEFAULT 'Traveler',
  status ENUM('active', 'suspended') DEFAULT 'active',
  contact_info VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Itineraries Table
CREATE TABLE IF NOT EXISTS itineraries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  destination VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget DECIMAL(10, 2) NOT NULL,
  activities JSON,
  notes TEXT,
  media_paths JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT check_dates CHECK (start_date <= end_date),
  CONSTRAINT check_budget CHECK (budget > 0)
);

-- Messages table for admin broadcasts, support tickets, and direct messages
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT,
  receiver_id INT,
  subject VARCHAR(255),
  content TEXT NOT NULL,
  message_type ENUM('broadcast', 'direct', 'support', 'system') DEFAULT 'direct',
  priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  status ENUM('pending', 'read', 'resolved', 'closed') DEFAULT 'pending',
  parent_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Notifications table for tracking user notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM('message', 'broadcast', 'support_reply', 'collaboration', 'system') NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  reference_id INT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Collaboration chat messages
CREATE TABLE IF NOT EXISTS collaboration_chats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  itinerary_id INT NOT NULL,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (itinerary_id) REFERENCES itineraries(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Itinerary Collaborators Table
CREATE TABLE IF NOT EXISTS itinerary_collaborators (
  id INT PRIMARY KEY AUTO_INCREMENT,
  itinerary_id INT NOT NULL,
  user_id INT NOT NULL,
  permission ENUM('view', 'edit') DEFAULT 'edit',
  invited_by INT NOT NULL,
  invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
  FOREIGN KEY (itinerary_id) REFERENCES itineraries(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id),
  UNIQUE KEY unique_collab (itinerary_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX idx_user_id ON itineraries(user_id);
CREATE INDEX idx_destination ON itineraries(destination);
CREATE INDEX idx_dates ON itineraries(start_date, end_date);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_type ON messages(message_type);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
