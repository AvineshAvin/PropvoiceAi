"""End-to-end API and service tests for PropVoice AI backend."""

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["service"] == "PropVoice AI"


def test_properties_list_and_filters():
    res = client.get("/api/properties")
    assert res.status_code == 200
    props = res.json()
    assert len(props) >= 15

    # Filter Bangalore 2 BHK under 80 lakhs
    res_filtered = client.get(
        "/api/properties",
        params={"city": "Bangalore", "bhk": "2 BHK", "listing_type": "buy", "max_price": 8000000},
    )
    assert res_filtered.status_code == 200
    filtered = res_filtered.json()
    assert len(filtered) >= 1
    assert all(p["city"] == "Bangalore" and p["bhk"] == "2 BHK" and p["price"] <= 8000000 for p in filtered)


def test_property_create_and_update():
    new_prop = {
        "property_name": "Test Residency",
        "city": "Bangalore",
        "location": "Koramangala",
        "property_type": "Apartment",
        "listing_type": "buy",
        "bhk": "2 BHK",
        "price": 9000000,
        "area_sqft": 1200,
        "amenities": ["Gym", "Lift"],
        "description": "Integration test property listing.",
        "possession_status": "Ready to Move",
        "availability_status": "Available",
        "is_demo": True,
    }
    create_res = client.post("/api/properties", json=new_prop)
    assert create_res.status_code == 201
    created = create_res.json()
    prop_id = created["property_id"]

    get_res = client.get(f"/api/properties/{prop_id}")
    assert get_res.status_code == 200
    assert get_res.json()["property_name"] == "Test Residency"

    upd_res = client.put(f"/api/properties/{prop_id}", json={"availability_status": "Limited"})
    assert upd_res.status_code == 200
    assert upd_res.json()["availability_status"] == "Limited"


def test_extract_requirements_and_lead_scoring():
    res = client.post(
        "/api/agent/extract-requirements",
        json={"text": "Hi, my name is Karthik. I want to buy a 2 BHK apartment in Whitefield Bangalore around 80 lakhs, ready to move. My number is 9876543210."},
    )
    assert res.status_code == 200
    data = res.json()
    req = data["extracted_requirements"]
    assert req["customer_name"] == "Karthik"
    assert req["intent"] == "buy"
    assert req["city"] == "Bangalore"
    assert req["location"] == "Whitefield"
    assert req["bhk"] == "2 BHK"
    assert req["budget_max"] == 8000000
    assert req["possession_preference"] == "Ready to Move"
    assert "9876543210" in req["contact_number"]
    assert data["score_breakdown"]["total_score"] >= 75
    assert data["score_breakdown"]["category"] == "HOT"


def test_conversational_agent_context_and_persistence():
    # Turn 1
    r1 = client.post(
        "/api/agent/chat",
        json={"message": "I want to buy an apartment in Bangalore."},
    )
    assert r1.status_code == 200
    d1 = r1.json()
    conv_id = d1["conversation_id"]
    lead_id = d1["lead_id"]
    assert d1["extracted_requirements"]["intent"] == "buy"
    assert d1["extracted_requirements"]["city"] == "Bangalore"

    # Turn 2 - must retain intent & city from Turn 1
    r2 = client.post(
        "/api/agent/chat",
        json={
            "conversation_id": conv_id,
            "message": "2 BHK around 80 lakhs, ready to move.",
        },
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["extracted_requirements"]["intent"] == "buy"
    assert d2["extracted_requirements"]["city"] == "Bangalore"
    assert d2["extracted_requirements"]["bhk"] == "2 BHK"
    assert d2["extracted_requirements"]["budget_max"] == 8000000
    assert len(d2["recommended_properties"]) >= 1

    # Verify conversation persisted
    conv_res = client.get(f"/api/conversations/{conv_id}")
    assert conv_res.status_code == 200
    assert len(conv_res.json()["messages"]) == 4

    # Verify lead persisted
    lead_res = client.get(f"/api/leads/{lead_id}")
    assert lead_res.status_code == 200
    assert lead_res.json()["city"] == "Bangalore"


def test_leads_and_followups_crud():
    lead_res = client.post(
        "/api/leads",
        json={
            "customer_name": "Meera Iyer",
            "phone_number": "+91 98400 55667",
            "intent": "buy",
            "city": "Chennai",
            "location": "OMR",
            "property_type": "Apartment",
            "bhk": "2 BHK",
            "budget_max": 7000000,
        },
    )
    assert lead_res.status_code == 201
    lead_id = lead_res.json()["lead_id"]

    fup_res = client.post(
        "/api/followups",
        json={
            "lead_id": lead_id,
            "task_type": "Site Visit",
            "scheduled_at": "2026-11-15T11:00:00",
            "notes": "Show Marina Horizon demo unit",
        },
    )
    assert fup_res.status_code == 201
    fup_id = fup_res.json()["followup_id"]

    upd_fup = client.put(f"/api/followups/{fup_id}", json={"status": "Completed"})
    assert upd_fup.status_code == 200
    assert upd_fup.json()["status"] == "Completed"


def test_dashboard_and_scoring_settings():
    stats_res = client.get("/api/dashboard/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_properties"] >= 15
    assert "hot_leads" in stats

    # Invalid weights (not summing to 100)
    bad_weights = client.put(
        "/api/settings/scoring",
        json={"intent": 10, "budget": 10, "completeness": 10, "timeline": 10, "engagement": 10},
    )
    assert bad_weights.status_code == 400


def test_agent_chat_stream_sse():
    import json

    with client.stream(
        "POST",
        "/api/agent/chat/stream",
        json={"message": "Show me 2 BHK apartments in Bangalore under 90 lakhs"},
    ) as resp:
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")
        raw_text = resp.read().decode("utf-8")

    events = []
    for block in raw_text.split("\n\n"):
        event_name = None
        data_line = None
        for line in block.splitlines():
            if line.startswith("event:"):
                event_name = line[6:].strip()
            elif line.startswith("data:"):
                data_line = line[5:].strip()
        if event_name and data_line:
            events.append((event_name, json.loads(data_line)))

    event_names = [e[0] for e in events]
    assert "sentence" in event_names
    assert "result" in event_names
    result_payload = next(p for name, p in events if name == "result")
    assert result_payload["reply"]
    assert "detected_language" in result_payload
    assert isinstance(result_payload.get("actions"), list)


def test_agent_website_actions_and_booking_confirmation():
    # Navigation + search
    nav_res = client.post(
        "/api/agent/chat",
        json={"message": "Go to properties page and search for 2 BHK in Bangalore"},
    )
    assert nav_res.status_code == 200
    nav_data = nav_res.json()
    action_types = [a["type"] for a in nav_data.get("actions", [])]
    assert "navigate" in action_types or "search_properties" in action_types

    # Compare
    cmp_res = client.post(
        "/api/agent/chat",
        json={
            "conversation_id": nav_data["conversation_id"],
            "message": "Compare these properties",
        },
    )
    assert cmp_res.status_code == 200
    cmp_types = [a["type"] for a in cmp_res.json().get("actions", [])]
    assert "compare_properties" in cmp_types

    # Book viewing -> must ask for confirmation first
    book_res = client.post(
        "/api/agent/chat",
        json={
            "conversation_id": nav_data["conversation_id"],
            "message": "Book a site visit for tomorrow at 11am",
        },
    )
    assert book_res.status_code == 200
    book_data = book_res.json()
    assert book_data["pending_confirmation"] is not None
    assert book_data["pending_confirmation"]["type"] == "book_viewing"

    # Confirm booking
    confirm_res = client.post(
        "/api/agent/chat",
        json={
            "conversation_id": nav_data["conversation_id"],
            "message": "Yes, confirm booking",
            "confirmed_action": book_data["pending_confirmation"],
        },
    )
    assert confirm_res.status_code == 200
    confirm_data = confirm_res.json()
    assert confirm_data["pending_confirmation"] is None
    assert "scheduled" in confirm_data["reply"].lower()


def test_agent_rate_limiting():
    from app.routes import agent as agent_routes

    agent_routes._REQUEST_LOG.clear()
    original_max = agent_routes._RATE_MAX_REQ
    agent_routes._RATE_MAX_REQ = 2
    try:
        r1 = client.post("/api/agent/chat", json={"message": "Hello"})
        r2 = client.post("/api/agent/chat", json={"message": "Hello again"})
        r3 = client.post("/api/agent/chat", json={"message": "Third request"})
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r3.status_code == 429
    finally:
        agent_routes._RATE_MAX_REQ = original_max
        agent_routes._REQUEST_LOG.clear()


def test_budget_and_city_regression_scripts():
    from app.services.ai_agent import parse_budget_from_text, resolve_city_from_text

    # Script 1: "I want a 2 BHK in Chennai" -> "Under 50 000" must NOT repeat budget question
    r1 = client.post("/api/agent/chat", json={"message": "I want a 2 BHK in Chennai"})
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["extracted_requirements"]["city"] == "Chennai"
    assert d1["extracted_requirements"]["bhk"] == "2 BHK"

    r2 = client.post(
        "/api/agent/chat",
        json={"conversation_id": d1["conversation_id"], "message": "Under 50 000"},
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["extracted_requirements"]["budget_max"] == 50000
    assert d2["extracted_requirements"]["intent"] == "rent"
    assert "approximate" not in d2["reply"].lower()
    assert d2["reply"] != d1["reply"]

    # Script 2: Budget parser formats
    assert parse_budget_from_text("fifty thousand")[1] == 50000
    assert parse_budget_from_text("50k")[1] == 50000
    assert parse_budget_from_text("50 000")[1] == 50000
    assert parse_budget_from_text("50,000")[1] == 50000
    assert parse_budget_from_text("1 lakh")[1] == 100000
    assert parse_budget_from_text("1.5 lakh")[1] == 150000
    assert parse_budget_from_text("2 crore")[1] == 20000000
    bmin, bmax, _ = parse_budget_from_text("between 30 and 50 thousand")
    assert (bmin, bmax) == (30000, 50000)

    # Script 3: City aliases & fuzzy mishearings
    assert resolve_city_from_text("Chennai")[0] == "Chennai"
    assert resolve_city_from_text("Channai")[0] == "Chennai"
    assert resolve_city_from_text("Madras")[0] == "Chennai"
    assert resolve_city_from_text("chinmay")[0] == "Chennai"
    assert resolve_city_from_text("chen eye")[0] == "Chennai"

    # Script 4: Spoken phone digits & strict budget ceiling (30000 must not return 45000)
    r_rent = client.post("/api/agent/chat", json={"message": "I want to rent a 2 BHK in Bangalore"})
    assert r_rent.status_code == 200
    r_30k = client.post(
        "/api/agent/chat",
        json={"conversation_id": r_rent.json()["conversation_id"], "message": "Thirty thousand"},
    )
    assert r_30k.status_code == 200
    d_30k = r_30k.json()
    assert d_30k["extracted_requirements"]["budget_max"] == 30000
    assert all(p["price"] <= 30000 for p in d_30k["recommended_properties"])
    assert "higher budget" in d_30k["reply"].lower()

    r_contact = client.post(
        "/api/agent/chat",
        json={
            "conversation_id": d1["conversation_id"],
            "message": "Uh yes my name is ivines And my phone number is six three eight three nine five one two two seven",
        },
    )
    assert r_contact.status_code == 200
    d_contact = r_contact.json()
    assert d_contact["extracted_requirements"]["customer_name"] == "Ivines"
    assert d_contact["extracted_requirements"]["contact_number"] == "+91 6383951227"
    assert "site visit" in d_contact["reply"].lower()
