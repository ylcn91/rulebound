---
title: Struct Validation at Boundaries
category: security
severity: error
modality: must
tags: [go, validation, api]
stack: [go]
scope: [backend]
---

# Struct Validation at Boundaries

All incoming data MUST be validated at API boundaries using struct tags or explicit validation. Never trust decoded input.

## Rules

- Validate all request structs before processing
- Use `go-playground/validator` tags or explicit Validate() methods
- Return structured validation errors with field names
- Validate at the handler layer, not in business logic
- Use custom validators for domain-specific rules

## Good Example

```go
type CreateOrderRequest struct {
    CustomerID string          `json:"customer_id" validate:"required,uuid"`
    Items      []OrderItemReq  `json:"items" validate:"required,min=1,dive"`
}

func (h *Handler) CreateOrder(w http.ResponseWriter, r *http.Request) {
    var req CreateOrderRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        respondError(w, http.StatusBadRequest, "invalid JSON")
        return
    }
    if err := h.validator.Struct(req); err != nil {
        respondValidationError(w, err)
        return
    }
    // proceed with validated data
}
```
