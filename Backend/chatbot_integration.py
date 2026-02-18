"""
Chatbot Integration for Resume Parser Application
Integrates the chatbot module with the database search functionality
"""

import sys
import os
from typing import Dict, List, Any, Optional

# Add chatbot-integration to path
chatbot_path = os.path.join(os.path.dirname(__file__), '..', 'chatbot-integration', 'src')
sys.path.insert(0, chatbot_path)

from chatbot import Chatbot, ChatbotConfig
from handlers.base import BaseHandler
import psycopg2.extras


class DatabaseSearchHandler(BaseHandler):
    """
    Handler for database search queries
    Connects chatbot to PostgreSQL database
    """
    
    def __init__(self, get_db_connection, candidates_table: str, skills_table: str):
        """
        Initialize database search handler
        
        Args:
            get_db_connection: Function that returns database connection
            candidates_table: Name of candidates table
            skills_table: Name of skills table
        """
        keywords = [
            "find", "search", "look for", "show me", "get", "list",
            "developer", "engineer", "candidate", "resume", "person",
            "python", "java", "react", "javascript", "node", "angular",
            "full stack", "frontend", "backend", "devops", "data",
            "senior", "junior", "mid-level", "experience"
        ]
        super().__init__(keywords)
        self.get_db_connection = get_db_connection
        self.candidates_table = candidates_table
        self.skills_table = skills_table
    
    def handle(self, query: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle database search query
        
        Args:
            query: User's search query
            context: Context dictionary
            
        Returns:
            Response with candidate results
        """
        try:
            # Search database
            results = self._search_candidates(query, limit=50)
            
            if not results:
                return {
                    "text": f"No candidates found matching '{query}'. Try different keywords or skills.",
                    "suggestions": [
                        "Python Developer",
                        "Full Stack Engineer",
                        "React Developer",
                        "Java Developer"
                    ],
                    "data": [],
                    "type": "candidates"
                }
            
            count = len(results)
            return {
                "text": f"Found {count} candidate{'s' if count != 1 else ''} matching your search:",
                "suggestions": self._generate_suggestions(query, results),
                "data": results,
                "type": "candidates"
            }
            
        except Exception as e:
            return {
                "text": f"Error searching candidates: {str(e)}",
                "suggestions": ["Try again", "Search Python Developer"],
                "data": None,
                "type": "error"
            }
    
    def _search_candidates(self, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Search candidates in database
        
        Args:
            query: Search query
            limit: Maximum number of results
            
        Returns:
            List of candidate dictionaries
        """
        conn = self.get_db_connection()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                # Split query into words for flexible matching
                words = [w.strip() for w in query.strip().split() if w.strip()]
                
                # Build search conditions
                where_conditions = []
                search_params = []
                
                for word in words:
                    pattern = f"%{word}%"
                    where_conditions.append("""(
                        c.first_name ILIKE %s 
                        OR c.last_name ILIKE %s 
                        OR CONCAT(c.first_name, ' ', c.last_name) ILIKE %s
                        OR c.address ILIKE %s 
                        OR s.job_title ILIKE %s
                        OR s.tech_skills ILIKE %s
                        OR c.qualification ILIKE %s
                    )""")
                    search_params.extend([pattern] * 7)
                
                where_clause = " AND ".join(where_conditions)
                
                sql = f"""
                    SELECT DISTINCT c.id, c.first_name, c.last_name, c.email, c.phone, 
                           c.address, c.profile_picture_url, s.job_title, c.qualification,
                           c.linkedin, s.tech_skills, s.years_of_experience
                    FROM {self.candidates_table} c
                    LEFT JOIN {self.skills_table} s ON c.id = s.candidate_id
                    WHERE {where_clause}
                    ORDER BY c.id
                    LIMIT %s
                """
                
                cursor.execute(sql, search_params + [limit])
                rows = cursor.fetchall()
                
                # Convert to list of dicts
                results = []
                for row in rows:
                    results.append({
                        "id": row["id"],
                        "name": f"{row.get('first_name', '')} {row.get('last_name', '')}".strip(),
                        "first_name": row.get("first_name"),
                        "last_name": row.get("last_name"),
                        "job_title": row.get("job_title"),
                        "location": row.get("address"),
                        "email": row.get("email"),
                        "phone": row.get("phone"),
                        "skills": row.get("tech_skills"),
                        "experience": row.get("years_of_experience"),
                        "education": row.get("qualification"),
                        "linkedin": row.get("linkedin"),
                        "profile_picture_url": row.get("profile_picture_url")
                    })
                
                return results
                
        finally:
            conn.close()
    
    def _generate_suggestions(self, query: str, results: List[Dict]) -> List[str]:
        """
        Generate follow-up suggestions based on results
        
        Args:
            query: Original query
            results: Search results
            
        Returns:
            List of suggestion strings
        """
        suggestions = []
        
        # Collect unique locations and skills from results
        locations = set()
        skills_set = set()
        
        for result in results[:10]:  # Check first 10
            if result.get("location"):
                # Extract city/state from location
                loc_parts = result["location"].split(",")
                if len(loc_parts) >= 2:
                    locations.add(loc_parts[-1].strip())  # State/country
            
            if result.get("skills"):
                # Extract individual skills
                skills = [s.strip() for s in result["skills"].split(",")]
                for skill in skills[:3]:  # First 3 skills
                    if skill:
                        skills_set.add(skill)
        
        # Create suggestions
        for loc in list(locations)[:2]:
            suggestions.append(f"{query} in {loc}")
        
        for skill in list(skills_set)[:2]:
            suggestions.append(f"{skill} developer")
        
        # Default suggestions if none generated
        if not suggestions:
            suggestions = [
                "Senior Python Developer",
                "Full Stack Engineer",
                "React Developer in California",
                "DevOps Engineer"
            ]
        
        return suggestions[:4]


class HelpHandler(BaseHandler):
    """Handler for help queries"""
    
    def __init__(self):
        keywords = ["help", "how", "what can you", "guide", "assist"]
        super().__init__(keywords)
    
    def handle(self, query: str, context: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "text": """I can help you find candidates! Here's what you can do:

• Search by skills: "Python Developer", "React Engineer"
• Search by location: "Developer in California"
• Combine both: "Full Stack Engineer in New York"
• Search by experience: "Senior Java Developer"

Just tell me what you're looking for!""",
            "suggestions": [
                "Find Python Developer",
                "Search React Engineer",
                "Full Stack Developer in Texas",
                "Senior Java Developer"
            ],
            "data": None,
            "type": "help"
        }


class GreetingHandler(BaseHandler):
    """Handler for greetings"""
    
    def __init__(self):
        keywords = ["hello", "hi", "hey", "greetings", "good morning", "good afternoon"]
        super().__init__(keywords)
    
    def handle(self, query: str, context: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "text": "Hello! 👋 I'm your AI assistant for finding candidates. What kind of talent are you looking for today?",
            "suggestions": [
                "Python Developer",
                "Full Stack Engineer",
                "Help me search",
                "What can you do?"
            ],
            "data": None,
            "type": "greeting"
        }


def create_resume_chatbot(get_db_connection, candidates_table: str, skills_table: str) -> Chatbot:
    """
    Create and configure chatbot for resume parsing application
    
    Args:
        get_db_connection: Function that returns database connection contextmanager
        candidates_table: Name of candidates table
        skills_table: Name of skills table
        
    Returns:
        Configured Chatbot instance
    """
    config = ChatbotConfig(
        app_name="Resume Parser AI Assistant",
        greeting_message="Hello! I can help you find candidates. Try asking 'find Python developer' or 'search Full Stack engineer'.",
        default_suggestions=[
            "Python Developer",
            "Full Stack Engineer",
            "React Developer",
            "Help"
        ],
        max_history=100,
        enable_nlp=True
    )
    
    bot = Chatbot(config)
    
    # Register handlers
    search_handler = DatabaseSearchHandler(get_db_connection, candidates_table, skills_table)
    bot.register_handler("search", search_handler)
    
    help_handler = HelpHandler()
    bot.register_handler("help", help_handler)
    
    greeting_handler = GreetingHandler()
    bot.register_handler("greeting", greeting_handler)
    
    return bot
