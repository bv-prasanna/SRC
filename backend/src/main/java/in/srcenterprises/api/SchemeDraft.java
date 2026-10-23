package in.srcenterprises.api;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
@Entity @Table(name="scheme_drafts")
public class SchemeDraft {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 @NotBlank @Size(max=120) public String name;
 @NotNull @Min(1) @Max(60) public Integer durationMonths;
 @NotBlank @Pattern(regexp="MONTHLY|QUARTERLY") public String frequency;
 @NotNull @DecimalMin("1.00") @Digits(integer=10,fraction=2) public BigDecimal contributionAmount;
 @Size(max=1000) public String internalNotes;
 @NotNull public Boolean complianceApproved=false;
 @Version public Long version;
}