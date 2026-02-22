"""LangGraph pipeline definition for PayBack bill analysis."""

from langgraph.graph import END, StateGraph

from services.agents.state import PayBackState
from services.agents.ocr_node import ocr_node
from services.agents.extract_node import extract_node
from services.agents.query_node import query_node
from services.agents.rules_node import rules_node


def build_graph():
    g = StateGraph(PayBackState)

    g.add_node("ocr", ocr_node)
    g.add_node("extract", extract_node)
    g.add_node("query", query_node)
    g.add_node("rules", rules_node)

    g.set_entry_point("ocr")
    g.add_edge("ocr", "extract")
    g.add_edge("extract", "query")
    g.add_edge("query", "rules")
    g.add_edge("rules", END)

    return g.compile()


pipeline = build_graph()
